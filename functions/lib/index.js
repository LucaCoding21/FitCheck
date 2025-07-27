"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDailyWinnersManual = exports.calculateDailyWinners = exports.postReminderScheduler = exports.flushBundlesScheduler = exports.dailyResetScheduler = exports.onUserJoinedGroup = exports.onCommentCreated = exports.onRatingCreated = exports.onPostCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
// Configuration constants
const CONFIG = {
    NOTIF_DAILY_CAP: 3,
    COMMENT_DAILY_CAP: 5,
    FRIEND_POST_COOLDOWN_MIN: 90,
    RATING_BUNDLE_THRESHOLD: 3,
    LAST_HOUR_FEATURE_FLAG: false,
    POST_REMINDER_WINDOW_START: 14, // 2 PM
    POST_REMINDER_WINDOW_END: 16, // 4 PM
};
// Notification types
var NotificationType;
(function (NotificationType) {
    NotificationType["POST_REMINDER"] = "post_reminder";
    NotificationType["FRIENDS_POSTED"] = "friends_posted";
    NotificationType["RATINGS_BUNDLED"] = "ratings_bundled";
    NotificationType["COMMENT"] = "comment";
    NotificationType["LEADERBOARD_WINNER"] = "leaderboard_winner";
    NotificationType["LEADERBOARD_RECAP"] = "leaderboard_recap";
    NotificationType["NEW_MEMBER"] = "new_member";
})(NotificationType || (NotificationType = {}));
// Notification copy variants
const NOTIFICATION_VARIANTS = {
    [NotificationType.POST_REMINDER]: [
        { title: "You haven't dropped today", body: "Post your fit to see everyone else's." },
        { title: "Your crew's waiting", body: "Drop a fit to unlock today's leaderboard." },
        { title: "Don't get benched today", body: "One fit. One rating war. You in?" },
    ],
    [NotificationType.FRIENDS_POSTED]: [
        { title: "{{count}} friends just posted fits", body: "Rate them before the board locks." },
        { title: "New heat in {{groupName}}", body: "{{topUser}} and {{countMinus1}} others just dropped." },
        { title: "Your group is active rn", body: "Hop in, rate them, take the crown." },
    ],
    [NotificationType.RATINGS_BUNDLED]: [
        { title: "{{count}} new ratings on your fit", body: "Where do you sit on the board now?" },
        { title: "Your score just moved", body: "Tap to see who bumped (or tanked) you." },
        { title: "You're getting judged 👀", body: "{{count}} friends rated your fit." },
    ],
    [NotificationType.COMMENT]: [
        { title: "New comment on your fit", body: "\"{{snippet}}\"" },
        { title: "{{username}} sounded off on your fit", body: "\"{{snippet}}\"" },
        { title: "Someone had thoughts…", body: "Tap to read the damage." },
    ],
    [NotificationType.LEADERBOARD_WINNER]: [
        { title: "You won {{groupName}} 👑", body: "Defend it tomorrow. Reset just hit." },
        { title: "Top fit of the day = you", body: "Crowned in {{groupName}}. Leaderboard resets now." },
        { title: "You finished #1", body: "Hall of Flame updated. New day, new smoke." },
    ],
    [NotificationType.LEADERBOARD_RECAP]: [
        { title: "{{winnerName}} took the crown", body: "New day, fresh board. Post early." },
        { title: "Leaderboard reset", body: "Yesterday's winner: {{winnerName}}. You up next?" },
        { title: "New day, clean slate", body: "Yesterday's top: {{winnerName}}. Drop heat today." },
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
function renderTemplate(template, context) {
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
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength - 3) + '...';
}
// Check if user should receive notification based on daily caps and cooldowns
async function shouldSendNotification(userId, type, now = new Date()) {
    var _a, _b, _c;
    const dateKey = getDateKey(now);
    const userRef = db.collection('users').doc(userId);
    try {
        const userDoc = await userRef.get();
        if (!userDoc.exists)
            return false;
        const userData = userDoc.data();
        // Check notification preferences
        const prefs = userData.notificationPreferences || {};
        if (prefs[`${type}Notifications`] === false)
            return false;
        // Check daily count
        const dailyCount = ((_b = (_a = userData.notifDailyCount) === null || _a === void 0 ? void 0 : _a[dateKey]) === null || _b === void 0 ? void 0 : _b[type]) || 0;
        const dailyCap = type === NotificationType.COMMENT ? CONFIG.COMMENT_DAILY_CAP : CONFIG.NOTIF_DAILY_CAP;
        if (dailyCount >= dailyCap)
            return false;
        // Check cooldown for specific types
        const lastSent = (_c = userData.notifLastSent) === null || _c === void 0 ? void 0 : _c[type];
        if (lastSent) {
            const lastSentTime = lastSent.toDate();
            const cooldownMs = CONFIG.FRIEND_POST_COOLDOWN_MIN * 60 * 1000;
            if (now.getTime() - lastSentTime.getTime() < cooldownMs) {
                return false;
            }
        }
        return true;
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('Error incrementing daily count:', error);
    }
}
// Send push notification to user
async function sendPushNotification(userId, notification, data = {}) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists)
            return false;
        const userData = userDoc.data();
        const pushToken = userData.pushToken;
        if (!pushToken)
            return false;
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
    }
    catch (error) {
        console.error('Error sending push notification:', error);
        return false;
    }
}
// Queue bundled notification
async function queueBundledNotification(userId, type, data) {
    const dateKey = getDateKey();
    try {
        await db.collection('notificationQueues').add({
            userId,
            type,
            data,
            dateKey,
            createdAt: admin.firestore.Timestamp.fromDate(new Date()),
            processed: false,
        });
    }
    catch (error) {
        console.error('Error queuing bundled notification:', error);
    }
}
// Cloud Functions
// 1. Post Created - Queue friends posted notifications
exports.onPostCreated = (0, firestore_1.onDocumentCreated)('fits/{fitId}', async (event) => {
    var _a;
    const fitData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const fitId = event.params.fitId;
    if (!fitData)
        return;
    try {
        // Get user data
        const userDoc = await db.collection('users').doc(fitData.userId).get();
        if (!userDoc.exists)
            return;
        const userData = userDoc.data();
        // Queue friends posted notification for each group
        for (const groupId of fitData.groupIds || []) {
            await queueBundledNotification(fitData.userId, NotificationType.FRIENDS_POSTED, {
                fitId,
                groupId,
                fitOwnerId: fitData.userId,
                fitOwnerName: userData.username,
            });
        }
        console.log(`Queued friends posted notification for fit ${fitId}`);
    }
    catch (error) {
        console.error('Error in onPostCreated:', error);
    }
});
// 2. Rating Created - Buffer and bundle ratings
exports.onRatingCreated = (0, firestore_1.onDocumentCreated)('ratings/{ratingId}', async (event) => {
    var _a;
    const ratingData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const ratingId = event.params.ratingId;
    if (!ratingData)
        return;
    try {
        // Update fit's rating count
        const fitRef = db.collection('fits').doc(ratingData.fitId);
        const fitDoc = await fitRef.get();
        if (!fitDoc.exists)
            return;
        const fitData = fitDoc.data();
        const newRatingCount = (fitData.ratingCount || 0) + 1;
        const newTotalRating = (fitData.totalRating || 0) + ratingData.rating;
        const newFairRating = newTotalRating / newRatingCount;
        await fitRef.update({
            ratingCount: newRatingCount,
            totalRating: newTotalRating,
            fairRating: newFairRating,
        });
        // Check if we should send bundled rating notification
        const lastNotifiedCount = fitData.lastNotifiedRatingsCount || 0;
        const newRatingsSinceLastNotification = newRatingCount - lastNotifiedCount;
        if (newRatingsSinceLastNotification >= CONFIG.RATING_BUNDLE_THRESHOLD) {
            await queueBundledNotification(fitData.userId, NotificationType.RATINGS_BUNDLED, {
                fitId: ratingData.fitId,
                count: newRatingsSinceLastNotification,
            });
            // Update last notified count
            await fitRef.update({
                lastNotifiedRatingsCount: newRatingCount,
            });
        }
        console.log(`Processed rating ${ratingId} for fit ${ratingData.fitId}`);
    }
    catch (error) {
        console.error('Error in onRatingCreated:', error);
    }
});
// 3. Comment Created - Immediate push
exports.onCommentCreated = (0, firestore_1.onDocumentCreated)('comments/{commentId}', async (event) => {
    var _a;
    const commentData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const commentId = event.params.commentId;
    if (!commentData)
        return;
    try {
        // Get fit data
        const fitDoc = await db.collection('fits').doc(commentData.fitId).get();
        if (!fitDoc.exists)
            return;
        const fitData = fitDoc.data();
        // Don't notify if commenting on own fit
        if (commentData.userId === fitData.userId)
            return;
        // Get commenter data
        const commenterDoc = await db.collection('users').doc(commentData.userId).get();
        if (!commenterDoc.exists)
            return;
        const commenterData = commenterDoc.data();
        const now = new Date();
        if (await shouldSendNotification(fitData.userId, NotificationType.COMMENT, now)) {
            const context = {
                snippet: truncateText(commentData.text),
                username: commenterData.username,
            };
            const variant = pickVariant(NotificationType.COMMENT, context);
            await sendPushNotification(fitData.userId, variant, Object.assign({ type: NotificationType.COMMENT, fitId: commentData.fitId, commentId }, context));
            await incrementDailyCount(fitData.userId, NotificationType.COMMENT, now);
        }
        console.log(`Sent comment notification for comment ${commentId}`);
    }
    catch (error) {
        console.error('Error in onCommentCreated:', error);
    }
});
// 4. User Joined Group (optional for MVP)
exports.onUserJoinedGroup = (0, firestore_1.onDocumentUpdated)('groups/{groupId}', async (event) => {
    var _a, _b;
    const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    const groupId = event.params.groupId;
    if (!beforeData || !afterData)
        return;
    try {
        const beforeMembers = beforeData.members || [];
        const afterMembers = afterData.members || [];
        // Find new members
        const newMembers = afterMembers.filter((memberId) => !beforeMembers.includes(memberId));
        if (newMembers.length === 0)
            return;
        // Get new member data
        const newMemberDoc = await db.collection('users').doc(newMembers[0]).get();
        if (!newMemberDoc.exists)
            return;
        const newMemberData = newMemberDoc.data();
        const now = new Date();
        // Notify existing members about new member
        for (const memberId of beforeMembers) {
            if (memberId !== newMembers[0]) {
                if (await shouldSendNotification(memberId, NotificationType.NEW_MEMBER, now)) {
                    const context = {
                        username: newMemberData.username,
                        groupName: afterData.name,
                    };
                    const variant = pickVariant(NotificationType.NEW_MEMBER, context);
                    await sendPushNotification(memberId, variant, Object.assign({ type: NotificationType.NEW_MEMBER, groupId, newMemberId: newMembers[0] }, context));
                    await incrementDailyCount(memberId, NotificationType.NEW_MEMBER, now);
                }
            }
        }
        console.log(`Sent new member notifications for group ${groupId}`);
    }
    catch (error) {
        console.error('Error in onUserJoinedGroup:', error);
    }
});
// 5. Daily Reset Scheduler - Calculate winners and send notifications
exports.dailyResetScheduler = (0, scheduler_1.onSchedule)({
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
            const fits = fitsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
            if (fits.length === 0)
                continue;
            // Calculate winner (simplified logic)
            const eligibleFits = fits.filter(fit => (fit.ratingCount || 0) >= 1);
            if (eligibleFits.length === 0)
                continue;
            const winner = eligibleFits.sort((a, b) => {
                const aRating = a.fairRating || 0;
                const bRating = b.fairRating || 0;
                return bRating - aRating;
            })[0];
            winners.set(groupId, Object.assign(Object.assign({}, winner), { groupName: groupData.name }));
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
            if (!groupDoc.exists)
                continue;
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
                    await sendPushNotification(memberId, variant, Object.assign({ type,
                        groupId, date: yesterdayKey }, context));
                    await incrementDailyCount(memberId, type, now);
                }
            }
        }
        console.log('Daily reset scheduler completed');
    }
    catch (error) {
        console.error('Error in dailyResetScheduler:', error);
    }
});
// 6. Flush Bundles - Run periodically to send bundled notifications
exports.flushBundlesScheduler = (0, scheduler_1.onSchedule)({
    schedule: '*/15 * * * *', // Every 15 minutes
    timeZone: 'America/Vancouver',
}, async (event) => {
    try {
        console.log('Flushing bundled notifications...');
        // Implementation for flushing bundles would go here
        console.log('Bundled notifications flushed');
    }
    catch (error) {
        console.error('Error in flushBundlesScheduler:', error);
    }
});
// 7. Post Reminder - Send reminders to users who haven't posted
exports.postReminderScheduler = (0, scheduler_1.onSchedule)({
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
    }
    catch (error) {
        console.error('Error in postReminderScheduler:', error);
    }
});
// Keep the existing daily winner calculation function
exports.calculateDailyWinners = (0, scheduler_1.onSchedule)({
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
            return;
        }
        const groups = groupsSnapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
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
                const fits = fitsSnapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
                console.log(`Found ${fits.length} fits for group ${group.name}`);
                if (fits.length === 0) {
                    console.log(`No fits found for group ${group.name}, skipping`);
                    continue;
                }
                // Filter by rating threshold
                const threshold = getRatingThreshold(group.memberCount || 1);
                const eligibleFits = fits.filter((fit) => (fit.ratingCount || 0) >= threshold);
                console.log(`Found ${eligibleFits.length} eligible fits (threshold: ${threshold})`);
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
                console.log(`Winner calculated for group ${group.name}: ${winner.userName} (${winner.fairRating}⭐)`);
                results.push({
                    groupId: group.id,
                    groupName: group.name,
                    winner: winner.userName,
                    rating: winner.fairRating,
                    success: true,
                });
            }
            catch (error) {
                console.error(`Error processing group ${group.name}:`, error);
                results.push({
                    groupId: group.id,
                    groupName: group.name,
                    error: error instanceof Error ? error.message : 'Unknown error',
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
    }
    catch (error) {
        console.error('Error in calculateDailyWinners:', error);
        throw error;
    }
});
// Helper function for rating threshold
function getRatingThreshold(groupSize) {
    if (groupSize <= 3)
        return 1;
    if (groupSize <= 6)
        return 2;
    if (groupSize <= 10)
        return 3;
    return 4;
}
// Manual trigger function for testing
exports.calculateDailyWinnersManual = (0, https_1.onRequest)(async (req, res) => {
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
        // Call the scheduled function logic
        const result = await exports.calculateDailyWinners.run({});
        res.status(200).json({
            success: true,
            result: result,
        });
    }
    catch (error) {
        console.error('Error in manual trigger:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=index.js.map