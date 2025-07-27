/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Configuration constants
const CONFIG = {
  NOTIF_DAILY_CAP: 10, // Increased for immediate notifications
  COMMENT_DAILY_CAP: 10,
  FRIEND_POST_COOLDOWN_MIN: 5, // Reduced cooldown for immediate notifications
  RATING_BUNDLE_THRESHOLD: 1, // Immediate rating notifications
  LAST_HOUR_FEATURE_FLAG: false,
  POST_REMINDER_WINDOW_START: 14, // 2 PM
  POST_REMINDER_WINDOW_END: 16,   // 4 PM
};

// Notification types
const NotificationType = {
  POST_REMINDER: 'post_reminder',
  FRIENDS_POSTED: 'friends_posted',
  RATINGS_BUNDLED: 'ratings_bundled',
  COMMENT: 'comment',
  LEADERBOARD_WINNER: 'leaderboard_winner',
  LEADERBOARD_RECAP: 'leaderboard_recap',
  NEW_MEMBER: 'new_member',
};

// Notification copy variants
const NOTIFICATION_VARIANTS = {
  [NotificationType.POST_REMINDER]: [
    { title: "You haven't posted today", body: "Post your fit to see everyone else's." },
    { title: "No fit, no leaderboard", body: "Drop something and start climbing." },
  ],
  [NotificationType.FRIENDS_POSTED]: [
    { title: "New outfit in {{groupName}}", body: "{{topUser}} and {{countMinus1}} others just posted." },
    { title: "{{groupName}} is active", body: "{{topUser}} and {{countMinus1}} others posted looks." },
  ],
  [NotificationType.RATINGS_BUNDLED]: [
    { title: "{{count}} new ratings on your fit", body: "Where do you sit on the board now?" },
    { title: "You got rated", body: "Check if they loved it or tanked you." },
  ],
  [NotificationType.COMMENT]: [
    { title: "New comment on your fit", body: "\"{{snippet}}\"" },
    { title: "{{username}} sounded off on your fit", body: "\"{{snippet}}\"" },
  ],
  [NotificationType.LEADERBOARD_WINNER]: [
    { title: "You won {{groupName}} ", body: "Defend it tomorrow. Reset just hit." },
    { title: "Top fit of the day = you", body: "Crowned in {{groupName}}. Leaderboard resets now." },
  ],
  [NotificationType.LEADERBOARD_RECAP]: [
    { title: "{{winnerName}} took the crown", body: "New day, fresh board. Post early." },
    { title: "Leaderboard reset", body: "Yesterday's winner: {{winnerName}}" },
  ],
  [NotificationType.NEW_MEMBER]: [
    { title: "{{username}} joined {{groupName}}", body: "More eyes on your fits." },
    { title: "New member alert", body: "{{username}} just joined {{groupName}}." },
    { title: "Squad's growing", body: "{{username}} pulled up. Post something good." },
  ],
};

// Utility functions
function getDateKey(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function getYesterdayKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateKey(yesterday);
}

function renderTemplate(template, context = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = context[key];
    return value !== undefined ? String(value) : match;
  });
}

function pickVariant(type, context = {}) {
  const variants = NOTIFICATION_VARIANTS[type];
  const randomIndex = Math.floor(Math.random() * variants.length);
  const variant = variants[randomIndex];
  
  return {
    title: renderTemplate(variant.title, context),
    body: renderTemplate(variant.body, context),
  };
}

function truncateText(text, maxLength = 40) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Check if user should receive notification based on daily caps and cooldowns
async function shouldSendNotification(userId, type, now = new Date()) {
  const dateKey = getDateKey(now);
  const userRef = db.collection('users').doc(userId);
  
  try {
    const userDoc = await userRef.get();
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    
    // Check notification preferences
    const prefs = userData.notificationPreferences || {};
    
    // Map notification types to preference field names
    const preferenceFieldMap = {
      [NotificationType.COMMENT]: 'commentNotifications',
      [NotificationType.FRIENDS_POSTED]: 'newFitNotifications',
      [NotificationType.RATINGS_BUNDLED]: 'ratingNotifications',
      [NotificationType.POST_REMINDER]: 'postReminderNotifications',
      [NotificationType.LEADERBOARD_WINNER]: 'leaderboardNotifications',
      [NotificationType.LEADERBOARD_RECAP]: 'leaderboardNotifications',
      [NotificationType.NEW_MEMBER]: 'newMemberNotifications',
    };
    
    const preferenceField = preferenceFieldMap[type];
    if (preferenceField && prefs[preferenceField] === false) return false;
    
    // Check daily count
    const dailyCount = userData.notifDailyCount?.[dateKey]?.[type] || 0;
    const dailyCap = type === NotificationType.COMMENT ? CONFIG.COMMENT_DAILY_CAP : CONFIG.NOTIF_DAILY_CAP;
    
    if (dailyCount >= dailyCap) return false;
    
    // Check cooldown for specific types
    const lastSent = userData.notifLastSent?.[type];
    if (lastSent) {
      const lastSentTime = lastSent.toDate();
      const cooldownMs = CONFIG.FRIEND_POST_COOLDOWN_MIN * 60 * 1000;
      
      if (now.getTime() - lastSentTime.getTime() < cooldownMs) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return false;
  }
}

// Increment daily notification count
async function incrementDailyCount(userId, type, now = new Date()) {
  const dateKey = getDateKey(now);
  const userRef = db.collection('users').doc(userId);
  
  try {
    await userRef.update({
      [`notifDailyCount.${dateKey}.${type}`]: admin.firestore.FieldValue.increment(1),
      [`notifLastSent.${type}`]: admin.firestore.Timestamp.fromDate(now),
    });
  } catch (error) {
    console.error('Error incrementing daily count:', error);
  }
}

// Send push notification to user
async function sendPushNotification(userId, notification, data = {}) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    const pushToken = userData.pushToken;
    
    if (!pushToken) return false;
    
    // Send via Expo push service
    const message = {
      to: pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: data,
    };
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    if (response.ok) {
      // Save notification to database
      await db.collection('notifications').add({
        userId,
        type: data.type || 'general',
        title: notification.title,
        body: notification.body,
        data,
        isRead: false,
        createdAt: admin.firestore.Timestamp.fromDate(new Date()),
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

// Queue bundled notification
// Simple immediate notification system - no bundling needed

// Helper: Get rating threshold based on group size
function getRatingThreshold(groupSize) {
  if (groupSize <= 3) return 1;
  if (groupSize <= 6) return 2;
  if (groupSize <= 10) return 3;
  return 4;
}

// Cloud Functions

// 1. Post Created - Immediate notification to group members
exports.onPostCreated = onDocumentCreated('fits/{fitId}', async (event) => {
  const fitData = event.data.data();
  const fitId = event.params.fitId;
  
  try {
    // Get user data
    const userDoc = await db.collection('users').doc(fitData.userId).get();
    if (!userDoc.exists) return;
    
    const userData = userDoc.data();
    const fitOwnerName = userData.username || 'Someone';
    
    // Send immediate notification to each group
    for (const groupId of fitData.groupIds || []) {
      // Get group data
      const groupDoc = await db.collection('groups').doc(groupId).get();
      if (!groupDoc.exists) continue;
      
      const groupData = groupDoc.data();
      const groupName = groupData.name || 'your group';
      const members = groupData.members || [];
      
      // Send notification to all group members except the fit owner
      for (const memberId of members) {
        if (memberId === fitData.userId) continue; // Don't notify yourself
        
        const now = new Date();
        if (await shouldSendNotification(memberId, NotificationType.FRIENDS_POSTED, now)) {
          const notification = {
            title: `New fit in ${groupName}`,
            body: `${fitOwnerName} just posted`,
          };
          
          await sendPushNotification(memberId, notification, {
            type: NotificationType.FRIENDS_POSTED,
            fitId,
            groupId,
            fitOwnerId: fitData.userId,
            fitOwnerName,
          });
          
          await incrementDailyCount(memberId, NotificationType.FRIENDS_POSTED, now);
        }
      }
    }
    
    console.log(`Sent immediate notifications for fit ${fitId}`);
  } catch (error) {
    console.error('Error in onPostCreated:', error);
  }
});

// 2. Fit Updated - Check for new ratings and comments
exports.onFitUpdated = onDocumentUpdated('fits/{fitId}', async (event) => {
  const fitId = event.params.fitId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  
  console.log('🔔 onFitUpdated: Function triggered', { fitId });
  
  try {
    // Check for new ratings
    const beforeRatings = beforeData.ratings || {};
    const afterRatings = afterData.ratings || {};
    const beforeRatingCount = Object.keys(beforeRatings).length;
    const afterRatingCount = Object.keys(afterRatings).length;
    
    if (afterRatingCount > beforeRatingCount) {
      console.log('🔔 onFitUpdated: New rating detected', { 
        fitId, 
        beforeRatingCount, 
        afterRatingCount 
      });
      
      // Find the new rating
      const newRaterId = Object.keys(afterRatings).find(
        raterId => !beforeRatings[raterId]
      );
      
      if (newRaterId && newRaterId !== afterData.userId) {
        const newRating = afterRatings[newRaterId];
        console.log('🔔 onFitUpdated: Processing new rating from', newRaterId, 'rating:', newRating.rating);
        
        // Send notification to fit owner
        const now = new Date();
        if (await shouldSendNotification(afterData.userId, NotificationType.RATINGS_BUNDLED, now)) {
          const notification = {
            title: 'New rating on your fit',
            body: `You got a ${newRating.rating}-star rating!`,
          };
          
          console.log('🔔 onFitUpdated: Sending rating notification', notification);
          
          const success = await sendPushNotification(afterData.userId, notification, {
            type: NotificationType.RATINGS_BUNDLED,
            fitId: fitId,
            rating: newRating.rating,
          });
          
          if (success) {
            await incrementDailyCount(afterData.userId, NotificationType.RATINGS_BUNDLED, now);
            console.log('✅ onFitUpdated: Rating notification sent successfully');
          } else {
            console.log('❌ onFitUpdated: Failed to send rating notification');
          }
        } else {
          console.log('🔔 onFitUpdated: Rating notification blocked by preferences or limits');
        }
      }
    }
    
    // Check for new comments
    const beforeComments = beforeData.comments || [];
    const afterComments = afterData.comments || [];
    
    if (afterComments.length > beforeComments.length) {
      console.log('🔔 onFitUpdated: New comment detected', { 
        fitId, 
        beforeCommentCount: beforeComments.length, 
        afterCommentCount: afterComments.length 
      });
      
      // Find the new comment
      const newComment = afterComments.find(
        comment => !beforeComments.some(beforeComment => 
          beforeComment.id === comment.id
        )
      );
      
      if (newComment && newComment.userId !== afterData.userId) {
        console.log('🔔 onFitUpdated: Processing new comment from', newComment.userId);
        
        // Get commenter data
        const commenterDoc = await db.collection('users').doc(newComment.userId).get();
        if (commenterDoc.exists) {
          const commenterData = commenterDoc.data();
          
          // Send notification to fit owner
          const now = new Date();
          if (await shouldSendNotification(afterData.userId, NotificationType.COMMENT, now)) {
            const context = {
              snippet: truncateText(newComment.text),
              username: commenterData.username || commenterData.displayName || commenterData.name || 'User',
            };
            
            const variant = pickVariant(NotificationType.COMMENT, context);
            
            console.log('🔔 onFitUpdated: Sending comment notification', variant);
            
            const success = await sendPushNotification(afterData.userId, variant, {
              type: NotificationType.COMMENT,
              fitId: fitId,
              commentId: newComment.id,
              ...context,
            });
            
            if (success) {
              await incrementDailyCount(afterData.userId, NotificationType.COMMENT, now);
              console.log('✅ onFitUpdated: Comment notification sent successfully');
            } else {
              console.log('❌ onFitUpdated: Failed to send comment notification');
            }
          } else {
            console.log('🔔 onFitUpdated: Comment notification blocked by preferences or limits');
          }
        }
      }
    }
    
    console.log(`✅ onFitUpdated: Function completed for fit ${fitId}`);
  } catch (error) {
    console.error('❌ onFitUpdated: Error in function:', error);
  }
});

// 3. Comment Created - Immediate push (DEPRECATED - now handled by onFitUpdated)
// This function is kept for backward compatibility but should not be used
exports.onCommentCreated = onDocumentCreated('comments/{commentId}', async (event) => {
  console.log('🔔 onCommentCreated: DEPRECATED - This function should not be triggered');
  console.log('🔔 onCommentCreated: Comments are now handled by onFitUpdated function');
  return;
});

// 4. User Joined Group (optional for MVP)
exports.onUserJoinedGroup = onDocumentCreated('groups/{groupId}', async (event) => {
  // This would need to be implemented as a custom trigger
  // For now, we'll skip this to keep it simple
  console.log('User joined group notification - not implemented in MVP');
});

// 5. Daily Reset Scheduler - Calculate winners and send notifications
exports.dailyResetScheduler = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'America/Vancouver',
}, async (event) => {
  try {
    console.log('Starting daily reset scheduler...');
    
    const yesterdayKey = getYesterdayKey();
    
    // Calculate winners for all groups
    const groupsSnapshot = await db.collection('groups').get();
    const winners = new Map();
    
    for (const groupDoc of groupsSnapshot.docs) {
      const groupData = groupDoc.data();
      const groupId = groupDoc.id;
      
      // Get fits for this group and date
      const fitsSnapshot = await db.collection('fits')
        .where('groupIds', 'array-contains', groupId)
        .where('date', '==', yesterdayKey)
        .get();
      
      const fits = fitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      if (fits.length === 0) continue;
      
      // Calculate winner (simplified logic - you can enhance this)
      const eligibleFits = fits.filter(fit => (fit.ratingCount || 0) >= 1);
      
      if (eligibleFits.length === 0) continue;
      
      const winner = eligibleFits.sort((a, b) => {
        const aRating = a.fairRating || 0;
        const bRating = b.fairRating || 0;
        return bRating - aRating;
      })[0];
      
      winners.set(groupId, {
        ...winner,
        groupName: groupData.name,
      });
      
      // Store winner in group's dailyWinners subcollection
      await db.collection('groups').doc(groupId)
        .collection('dailyWinners')
        .doc(yesterdayKey)
        .set({
          date: yesterdayKey,
          winner: {
            fitId: winner.id,
            userId: winner.userId,
            userName: winner.userName,
            userProfileImageURL: winner.userProfileImageURL,
            imageURL: winner.imageURL,
            caption: winner.caption,
            tag: (winner.tags && winner.tags[0]) || '',
            averageRating: winner.fairRating,
            ratingCount: winner.ratingCount,
            createdAt: winner.createdAt,
          },
          calculatedAt: admin.firestore.Timestamp.fromDate(new Date()),
          groupId,
          groupName: groupData.name,
        });
    }
    
    // Send winner and recap notifications
    const now = new Date();
    
    for (const [groupId, winner] of winners) {
      const groupDoc = await db.collection('groups').doc(groupId).get();
      if (!groupDoc.exists) continue;
      
      const groupData = groupDoc.data();
      const members = groupData.members || [];
      
      for (const memberId of members) {
        const isWinner = memberId === winner.userId;
        const type = isWinner ? NotificationType.LEADERBOARD_WINNER : NotificationType.LEADERBOARD_RECAP;
        
        if (await shouldSendNotification(memberId, type, now)) {
          const context = isWinner 
            ? { groupName: groupData.name }
            : { winnerName: winner.userName };
          
          const variant = pickVariant(type, context);
          
          await sendPushNotification(memberId, variant, {
            type,
            groupId,
            date: yesterdayKey,
            ...context,
          });
          
          await incrementDailyCount(memberId, type, now);
        }
      }
    }
    
    // No more bundling - notifications are sent immediately
    
    console.log('Daily reset scheduler completed');
  } catch (error) {
    console.error('Error in dailyResetScheduler:', error);
  }
});

// 6. Flush Bundles - No longer needed with immediate notifications
// Removed: No more bundling, notifications are sent immediately

// 7. Post Reminder - Send reminders to users who haven't posted
exports.postReminderScheduler = onSchedule({
  schedule: '0 14 * * *', // 2 PM daily
  timeZone: 'America/Vancouver',
}, async (event) => {
  try {
    console.log('Sending post reminders...');
    
    const todayKey = getDateKey();
    const now = new Date();
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      // Check if user has posted today
      const fitsSnapshot = await db.collection('fits')
        .where('userId', '==', userId)
        .where('date', '==', todayKey)
        .limit(1)
        .get();
      
      if (fitsSnapshot.empty) {
        // User hasn't posted today, send reminder
        if (await shouldSendNotification(userId, NotificationType.POST_REMINDER, now)) {
          const variant = pickVariant(NotificationType.POST_REMINDER);
          
          await sendPushNotification(userId, variant, {
            type: NotificationType.POST_REMINDER,
            date: todayKey,
          });
          
          await incrementDailyCount(userId, NotificationType.POST_REMINDER, now);
        }
      }
    }
    
    console.log('Post reminders sent');
  } catch (error) {
    console.error('Error in postReminderScheduler:', error);
  }
});

// Keep the existing daily winner calculation function
exports.calculateDailyWinners = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'America/Vancouver',
}, async (event) => {
  try {
    console.log('Starting daily winner calculation...');

    const yesterdayKey = getYesterdayKey();
    console.log(`Calculating winners for date: ${yesterdayKey}`);

    // Get all groups
    const groupsSnapshot = await db.collection('groups').get();

    if (groupsSnapshot.empty) {
      console.log('No groups found');
      return null;
    }

    const groups = groupsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`Found ${groups.length} groups to process`);

    // Calculate winners for each group
    const results = [];

    for (const group of groups) {
      try {
        console.log(`Processing group: ${group.name} (${group.id})`);

        // Get fits for this group and date
        const fitsSnapshot = await db.collection('fits')
          .where('groupIds', 'array-contains', group.id)
          .where('date', '==', yesterdayKey)
          .get();

        const fits = fitsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        console.log(`Found ${fits.length} fits for group ${group.name}`);

        if (fits.length === 0) {
          console.log(`No fits found for group ${group.name}, skipping`);
          continue;
        }

        // Filter by rating threshold
        const threshold = getRatingThreshold(group.memberCount || 1);
        const eligibleFits = fits.filter((fit) => (fit.ratingCount || 0) >= threshold);

        console.log(
          `Found ${eligibleFits.length} eligible fits (threshold: ${threshold})`
        );

        if (eligibleFits.length === 0) {
          console.log(`No eligible fits for group ${group.name}, skipping`);
          continue;
        }

        // Sort with tie-breaking logic
        const sorted = eligibleFits.sort((a, b) => {
          const aRating = a.fairRating || 0;
          const bRating = b.fairRating || 0;
          const aCount = a.ratingCount || 0;
          const bCount = b.ratingCount || 0;
          const aTime = (a.createdAt && a.createdAt.toMillis && a.createdAt.toMillis()) ||
            (a.createdAt && a.createdAt.seconds) || 0;
          const bTime = (b.createdAt && b.createdAt.toMillis && b.createdAt.toMillis()) ||
            (b.createdAt && b.createdAt.seconds) || 0;

          if (aRating !== bRating) {
            return bRating - aRating;
          }

          if (aCount !== bCount) {
            return bCount - aCount;
          }

          return aTime - bTime;
        });

        const winner = sorted[0];

        // Prepare winner data
        const winnerData = {
          date: yesterdayKey,
          winner: {
            fitId: winner.id,
            userId: winner.userId,
            userName: winner.userName,
            userProfileImageURL: winner.userProfileImageURL,
            imageURL: winner.imageURL,
            caption: winner.caption,
            tag: (winner.tags && winner.tags[0]) || '',
            averageRating: winner.fairRating,
            ratingCount: winner.ratingCount,
            createdAt: winner.createdAt,
          },
          calculatedAt: admin.firestore.Timestamp.fromDate(new Date()),
          groupId: group.id,
          groupName: group.name,
        };

        // Store winner in group's dailyWinners subcollection
        await db.collection('groups').doc(group.id)
          .collection('dailyWinners')
          .doc(yesterdayKey)
          .set(winnerData);

        console.log(
          `Winner calculated for group ${group.name}: ${winner.userName} (${winner.fairRating}⭐)`
        );

        results.push({
          groupId: group.id,
          groupName: group.name,
          winner: winner.userName,
          rating: winner.fairRating,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing group ${group.name}:`, error);
        results.push({
          groupId: group.id,
          groupName: group.name,
          error: error.message,
          success: false,
        });
      }
    }

    console.log('Daily winner calculation completed');
    console.log('Results:', results);

    return {
      date: yesterdayKey,
      groupsProcessed: groups.length,
      winnersCalculated: results.filter((r) => r.success).length,
      results: results,
    };
  } catch (error) {
    console.error('Error in calculateDailyWinners:', error);
    throw error;
  }
});

// Manual trigger function for testing
exports.calculateDailyWinnersManual = onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).send('Unauthorized');
      return;
    }

    const result = await exports.calculateDailyWinners.run();

    res.status(200).json({
      success: true,
      result: result,
    });
  } catch (error) {
    console.error('Error in manual trigger:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// DEMO ACCOUNT SYSTEM FOR APP STORE REVIEW
// ============================================================================

// Demo account constants
const DEMO_CONFIG = {
  DEMO_USER_ID: 'demo-reviewer-account',
  DEMO_GROUP_ID: 'demo-group-123',
  DEMO_USER_EMAIL: 'reviewer@example.com',
  DEMO_USERNAME: 'DemoReviewer',
  DEMO_GROUP_NAME: 'Demo Fashion Crew',
  DEMO_FIT_IMAGES: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=600&fit=crop',
    'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=600&fit=crop',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=600&fit=crop',
    'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=400&h=600&fit=crop',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=600&fit=crop',
  ],
  DEMO_CAPTIONS: [
    'Clean fit for the day',
    'Casual Friday vibes',
    'Weekend warrior look',
    'Office appropriate style',
    'Streetwear essentials',
  ],
  DEMO_TAGS: ['casual', 'streetwear', 'minimal', 'trendy', 'classic'],
};

// Create demo account and data
exports.createDemoAccount = onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    console.log('Creating demo account and data...');

    // Create Firebase Auth user first
    try {
      await admin.auth().createUser({
        uid: DEMO_CONFIG.DEMO_USER_ID,
        email: DEMO_CONFIG.DEMO_USER_EMAIL,
        password: 'ReviewTest123!',
        displayName: DEMO_CONFIG.DEMO_USERNAME,
        photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
        emailVerified: true,
      });
      console.log('Firebase Auth demo user created successfully');
    } catch (error) {
      if (error.code === 'auth/uid-already-exists') {
        console.log('Firebase Auth demo user already exists');
      } else {
        throw error;
      }
    }

    // Create demo user in Firestore
    await db.collection('users').doc(DEMO_CONFIG.DEMO_USER_ID).set({
      email: DEMO_CONFIG.DEMO_USER_EMAIL,
      username: DEMO_CONFIG.DEMO_USERNAME,
      profileImageURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
      createdAt: admin.firestore.Timestamp.fromDate(new Date()),
      isDemoAccount: true,
      notificationPreferences: {
        commentNotifications: true,
        ratingNotifications: true,
        newFitNotifications: true,
        postReminderNotifications: true,
        leaderboardNotifications: true,
        newMemberNotifications: true,
      },
    });

    // Create demo group
    await db.collection('groups').doc(DEMO_CONFIG.DEMO_GROUP_ID).set({
      name: DEMO_CONFIG.DEMO_GROUP_NAME,
      members: [DEMO_CONFIG.DEMO_USER_ID],
      createdAt: admin.firestore.Timestamp.fromDate(new Date()),
      isDemoGroup: true,
      description: 'Demo group for App Store review testing',
    });

    // Create sample fits for the last 7 days
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    const fitPromises = dates.map(async (date, index) => {
      const imageIndex = index % DEMO_CONFIG.DEMO_FIT_IMAGES.length;
      const captionIndex = index % DEMO_CONFIG.DEMO_CAPTIONS.length;
      const tagIndex = index % DEMO_CONFIG.DEMO_TAGS.length;
      
      const ratingCount = Math.floor(Math.random() * 5) + 1;
      const fairRating = (Math.random() * 2 + 3).toFixed(1); // 3.0 to 5.0

      return db.collection('fits').add({
        userId: DEMO_CONFIG.DEMO_USER_ID,
        groupIds: [DEMO_CONFIG.DEMO_GROUP_ID],
        imageURL: DEMO_CONFIG.DEMO_FIT_IMAGES[imageIndex],
        caption: DEMO_CONFIG.DEMO_CAPTIONS[captionIndex],
        tags: [DEMO_CONFIG.DEMO_TAGS[tagIndex]],
        date: date,
        createdAt: admin.firestore.Timestamp.fromDate(new Date()),
        ratingCount: ratingCount,
        fairRating: parseFloat(fairRating),
        userProfileImageURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
        userName: DEMO_CONFIG.DEMO_USERNAME,
      });
    });

    await Promise.all(fitPromises);

    // Create some demo winners for past dates
    const winnerPromises = dates.slice(0, 3).map(async (date) => {
      return db.collection('groups').doc(DEMO_CONFIG.DEMO_GROUP_ID)
        .collection('dailyWinners')
        .doc(date)
        .set({
          date: date,
          winner: {
            fitId: `demo-fit-${date}`,
            userId: DEMO_CONFIG.DEMO_USER_ID,
            userName: DEMO_CONFIG.DEMO_USERNAME,
            userProfileImageURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
            imageURL: DEMO_CONFIG.DEMO_FIT_IMAGES[0],
            caption: 'Demo winner fit',
            tag: 'demo',
            averageRating: 4.5,
            ratingCount: 3,
            createdAt: admin.firestore.Timestamp.fromDate(new Date()),
          },
          calculatedAt: admin.firestore.Timestamp.fromDate(new Date()),
          groupId: DEMO_CONFIG.DEMO_GROUP_ID,
          groupName: DEMO_CONFIG.DEMO_GROUP_NAME,
        });
    });

    await Promise.all(winnerPromises);

    console.log('Demo account and data created successfully');

    res.status(200).json({
      success: true,
      message: 'Demo account and data created successfully',
      demoAccount: {
        email: DEMO_CONFIG.DEMO_USER_EMAIL,
        password: 'ReviewTest123!',
        groupName: DEMO_CONFIG.DEMO_GROUP_NAME,
      },
    });
  } catch (error) {
    console.error('Error creating demo account:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Reset demo data
exports.resetDemoData = onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    console.log('Resetting demo data...');

    // Clear existing demo fits
    const fitsSnapshot = await db.collection('fits')
      .where('userId', '==', DEMO_CONFIG.DEMO_USER_ID)
      .get();

    const deletePromises = fitsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    // Clear existing demo winners
    const winnersSnapshot = await db.collection('groups').doc(DEMO_CONFIG.DEMO_GROUP_ID)
      .collection('dailyWinners')
      .get();

    const deleteWinnerPromises = winnersSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deleteWinnerPromises);

    // Create fresh demo data for the last 5 days
    const dates = [];
    for (let i = 4; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    const fitPromises = dates.map(async (date, index) => {
      const imageIndex = index % DEMO_CONFIG.DEMO_FIT_IMAGES.length;
      const captionIndex = index % DEMO_CONFIG.DEMO_CAPTIONS.length;
      const tagIndex = index % DEMO_CONFIG.DEMO_TAGS.length;
      
      const ratingCount = Math.floor(Math.random() * 5) + 1;
      const fairRating = (Math.random() * 2 + 3).toFixed(1); // 3.0 to 5.0

      return db.collection('fits').add({
        userId: DEMO_CONFIG.DEMO_USER_ID,
        groupIds: [DEMO_CONFIG.DEMO_GROUP_ID],
        imageURL: DEMO_CONFIG.DEMO_FIT_IMAGES[imageIndex],
        caption: DEMO_CONFIG.DEMO_CAPTIONS[captionIndex],
        tags: [DEMO_CONFIG.DEMO_TAGS[tagIndex]],
        date: date,
        createdAt: admin.firestore.Timestamp.fromDate(new Date()),
        ratingCount: ratingCount,
        fairRating: parseFloat(fairRating),
        userProfileImageURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
        userName: DEMO_CONFIG.DEMO_USERNAME,
      });
    });

    await Promise.all(fitPromises);

    // Create demo winners for past dates
    const winnerPromises = dates.slice(0, 2).map(async (date) => {
      return db.collection('groups').doc(DEMO_CONFIG.DEMO_GROUP_ID)
        .collection('dailyWinners')
        .doc(date)
        .set({
          date: date,
          winner: {
            fitId: `demo-fit-${date}`,
            userId: DEMO_CONFIG.DEMO_USER_ID,
            userName: DEMO_CONFIG.DEMO_USERNAME,
            userProfileImageURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
            imageURL: DEMO_CONFIG.DEMO_FIT_IMAGES[0],
            caption: 'Demo winner fit',
            tag: 'demo',
            averageRating: 4.5,
            ratingCount: 3,
            createdAt: admin.firestore.Timestamp.fromDate(new Date()),
          },
          calculatedAt: admin.firestore.Timestamp.fromDate(new Date()),
          groupId: DEMO_CONFIG.DEMO_GROUP_ID,
          groupName: DEMO_CONFIG.DEMO_GROUP_NAME,
        });
    });

    await Promise.all(winnerPromises);

    console.log('Demo data reset successfully');

    res.status(200).json({
      success: true,
      message: 'Demo data reset successfully',
    });
  } catch (error) {
    console.error('Error resetting demo data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Check if demo account exists
exports.checkDemoAccount = onRequest(async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const demoUserDoc = await db.collection('users').doc(DEMO_CONFIG.DEMO_USER_ID).get();
    const demoGroupDoc = await db.collection('groups').doc(DEMO_CONFIG.DEMO_GROUP_ID).get();

    const exists = demoUserDoc.exists && demoGroupDoc.exists;

    res.status(200).json({
      success: true,
      exists: exists,
      demoAccount: exists ? {
        email: 'reviewer@example.com',
        password: 'ReviewTest123!',
        groupName: DEMO_CONFIG.DEMO_GROUP_NAME,
      } : null,
    });
  } catch (error) {
    console.error('Error checking demo account:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create Firebase Auth demo user
exports.createDemoAuthUser = onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    console.log('Creating Firebase Auth demo user...');

    // Create the user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      uid: DEMO_CONFIG.DEMO_USER_ID,
      email: DEMO_CONFIG.DEMO_USER_EMAIL,
      password: 'ReviewTest123!',
      displayName: DEMO_CONFIG.DEMO_USERNAME,
      photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
      emailVerified: true,
    });

    console.log('Firebase Auth demo user created successfully:', userRecord.uid);

    res.status(200).json({
      success: true,
      message: 'Firebase Auth demo user created successfully',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
      },
    });
  } catch (error) {
    console.error('Error creating Firebase Auth demo user:', error);
    
    // If user already exists, that's fine
    if (error.code === 'auth/uid-already-exists') {
      res.status(200).json({
        success: true,
        message: 'Firebase Auth demo user already exists',
        user: {
          uid: DEMO_CONFIG.DEMO_USER_ID,
          email: DEMO_CONFIG.DEMO_USER_EMAIL,
          displayName: DEMO_CONFIG.DEMO_USERNAME,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
});

// ============================================================================
// MODIFIED DAILY RESET TO SKIP DEMO ACCOUNTS
// ============================================================================

// Override the existing dailyResetScheduler to skip demo accounts
exports.dailyResetSchedulerWithDemoSkip = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'America/Vancouver',
}, async (event) => {
  try {
    console.log('Starting daily reset scheduler (with demo skip)...');
    
    const yesterdayKey = getYesterdayKey();
    
    // Calculate winners for all groups EXCEPT demo groups
    const groupsSnapshot = await db.collection('groups').get();
    const winners = new Map();
    
    for (const groupDoc of groupsSnapshot.docs) {
      const groupData = groupDoc.data();
      const groupId = groupDoc.id;
      
      // Skip demo groups
      if (groupData.isDemoGroup) {
        console.log('Skipping demo group in daily reset:', groupData.name);
        continue;
      }
      
      // Get fits for this group and date
      const fitsSnapshot = await db.collection('fits')
        .where('groupIds', 'array-contains', groupId)
        .where('date', '==', yesterdayKey)
        .get();
      
      const fits = fitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      if (fits.length === 0) continue;
      
      // Calculate winner (simplified logic - you can enhance this)
      const eligibleFits = fits.filter(fit => (fit.ratingCount || 0) >= 1);
      
      if (eligibleFits.length === 0) continue;
      
      const winner = eligibleFits.sort((a, b) => {
        const aRating = a.fairRating || 0;
        const bRating = b.fairRating || 0;
        return bRating - aRating;
      })[0];
      
      winners.set(groupId, {
        ...winner,
        groupName: groupData.name,
      });
      
      // Store winner in group's dailyWinners subcollection
      await db.collection('groups').doc(groupId)
        .collection('dailyWinners')
        .doc(yesterdayKey)
        .set({
          date: yesterdayKey,
          winner: {
            fitId: winner.id,
            userId: winner.userId,
            userName: winner.userName,
            userProfileImageURL: winner.userProfileImageURL,
            imageURL: winner.imageURL,
            caption: winner.caption,
            tag: (winner.tags && winner.tags[0]) || '',
            averageRating: winner.fairRating,
            ratingCount: winner.ratingCount,
            createdAt: winner.createdAt,
          },
          calculatedAt: admin.firestore.Timestamp.fromDate(new Date()),
          groupId,
          groupName: groupData.name,
        });
    }
    
    // Send winner and recap notifications (skip demo users)
    const now = new Date();
    
    for (const [groupId, winner] of winners) {
      const groupDoc = await db.collection('groups').doc(groupId).get();
      if (!groupDoc.exists) continue;
      
      const groupData = groupDoc.data();
      const members = groupData.members || [];
      
      for (const memberId of members) {
        // Skip demo users
        if (memberId === DEMO_CONFIG.DEMO_USER_ID) {
          console.log('Skipping demo user in notifications');
          continue;
        }
        
        const isWinner = memberId === winner.userId;
        const type = isWinner ? NotificationType.LEADERBOARD_WINNER : NotificationType.LEADERBOARD_RECAP;
        
        if (await shouldSendNotification(memberId, type, now)) {
          const context = isWinner 
            ? { groupName: groupData.name }
            : { winnerName: winner.userName };
          
          const variant = pickVariant(type, context);
          
          await sendPushNotification(memberId, variant, {
            type,
            groupId,
            date: yesterdayKey,
            ...context,
          });
          
          await incrementDailyCount(memberId, type, now);
        }
      }
    }
    
    console.log('Daily reset scheduler completed (demo accounts skipped)');
  } catch (error) {
    console.error('Error in dailyResetSchedulerWithDemoSkip:', error);
  }
});

// Override the existing calculateDailyWinners to skip demo accounts
exports.calculateDailyWinnersWithDemoSkip = onSchedule({
  schedule: '0 0 * * *',
  timeZone: 'America/Vancouver',
}, async (event) => {
  try {
    console.log('Starting daily winner calculation (with demo skip)...');

    const yesterdayKey = getYesterdayKey();
    console.log(`Calculating winners for date: ${yesterdayKey}`);

    // Get all groups EXCEPT demo groups
    const groupsSnapshot = await db.collection('groups').get();

    if (groupsSnapshot.empty) {
      console.log('No groups found');
      return null;
    }

    const groups = groupsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(group => !group.isDemoGroup); // Filter out demo groups

    console.log(`Found ${groups.length} non-demo groups to process`);

    // Calculate winners for each group
    const results = [];

    for (const group of groups) {
      try {
        console.log(`Processing group: ${group.name}`);

        // Get fits for this group and date
        const fitsSnapshot = await db.collection('fits')
          .where('groupIds', 'array-contains', group.id)
          .where('date', '==', yesterdayKey)
          .get();

        const fits = fitsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (fits.length === 0) {
          console.log(`No fits found for group ${group.name} on ${yesterdayKey}`);
          results.push({
            groupId: group.id,
            groupName: group.name,
            message: 'No fits found',
            success: true,
          });
          continue;
        }

        console.log(`Found ${fits.length} fits for group ${group.name}`);

        // Filter out demo fits
        const nonDemoFits = fits.filter(fit => fit.userId !== DEMO_CONFIG.DEMO_USER_ID);
        
        if (nonDemoFits.length === 0) {
          console.log(`No non-demo fits found for group ${group.name}`);
          results.push({
            groupId: group.id,
            groupName: group.name,
            message: 'No non-demo fits found',
            success: true,
          });
          continue;
        }

        // Calculate winner
        const eligibleFits = nonDemoFits.filter(fit => (fit.ratingCount || 0) >= 1);

        if (eligibleFits.length === 0) {
          console.log(`No eligible fits found for group ${group.name}`);
          results.push({
            groupId: group.id,
            groupName: group.name,
            message: 'No eligible fits found',
            success: true,
          });
          continue;
        }

        // Sort by rating (highest first), then by rating count (highest first), then by time (earliest first)
        const sorted = eligibleFits.sort((a, b) => {
          const aRating = a.fairRating || 0;
          const bRating = b.fairRating || 0;

          if (aRating !== bRating) {
            return bRating - aRating;
          }

          const aCount = a.ratingCount || 0;
          const bCount = b.ratingCount || 0;

          if (aCount !== bCount) {
            return bCount - aCount;
          }

          return aTime - bTime;
        });

        const winner = sorted[0];

        // Prepare winner data
        const winnerData = {
          date: yesterdayKey,
          winner: {
            fitId: winner.id,
            userId: winner.userId,
            userName: winner.userName,
            userProfileImageURL: winner.userProfileImageURL,
            imageURL: winner.imageURL,
            caption: winner.caption,
            tag: (winner.tags && winner.tags[0]) || '',
            averageRating: winner.fairRating,
            ratingCount: winner.ratingCount,
            createdAt: winner.createdAt,
          },
          calculatedAt: admin.firestore.Timestamp.fromDate(new Date()),
          groupId: group.id,
          groupName: group.name,
        };

        // Store winner in group's dailyWinners subcollection
        await db.collection('groups').doc(group.id)
          .collection('dailyWinners')
          .doc(yesterdayKey)
          .set(winnerData);

        console.log(
          `Winner calculated for group ${group.name}: ${winner.userName} (${winner.fairRating}⭐)`
        );

        results.push({
          groupId: group.id,
          groupName: group.name,
          winner: winner.userName,
          rating: winner.fairRating,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing group ${group.name}:`, error);
        results.push({
          groupId: group.id,
          groupName: group.name,
          error: error.message,
          success: false,
        });
      }
    }

    console.log('Daily winner calculation completed (demo accounts skipped)');
    console.log('Results:', results);

    return {
      date: yesterdayKey,
      groupsProcessed: groups.length,
      winnersCalculated: results.filter((r) => r.success).length,
      results: results,
    };
  } catch (error) {
    console.error('Error in calculateDailyWinnersWithDemoSkip:', error);
    throw error;
  }
});
