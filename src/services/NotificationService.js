import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    // Track recent rating notifications to prevent spam
    this.recentRatingNotifications = new Map(); // userId_fitId -> timestamp
    this.RATING_COOLDOWN_MS = 30000; // 30 seconds cooldown between rating notifications
    this.initialized = false;
  }

  // Initialize notification service
  async initialize() {
    try {
      console.log('🔔 NotificationService: Starting initialization...');
      
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('🔔 NotificationService: Existing permission status:', existingStatus);
      
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        console.log('🔔 NotificationService: Requesting permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('🔔 NotificationService: New permission status:', finalStatus);
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ NotificationService: Failed to get push notification permissions!');
        return false;
      }

      // Get push token
      if (Device.isDevice) {
        console.log('🔔 NotificationService: Getting Expo push token...');
        this.expoPushToken = (await Notifications.getExpoPushTokenAsync({
          projectId: 'f2827a96-31a7-42b8-978a-3f54697a207d',
        })).data;
        console.log('✅ NotificationService: Expo push token obtained:', this.expoPushToken);
      } else {
        console.log('⚠️ NotificationService: Must use physical device for Push Notifications');
        return false;
      }

      // Set up notification listeners
      this.setupNotificationListeners();
      
      this.initialized = true;
      console.log('✅ NotificationService: Initialization complete');
      return true;
    } catch (error) {
      console.error('❌ NotificationService: Error initializing notifications:', error);
      return false;
    }
  }

  // Set up notification listeners
  setupNotificationListeners() {
    console.log('🔔 NotificationService: Setting up notification listeners...');
    
    // Listen for incoming notifications
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 NotificationService: Notification received:', notification);
    });

    // Listen for notification responses (when user taps notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('🔔 NotificationService: Notification response:', response);
      // Handle notification tap - navigate to appropriate screen
      this.handleNotificationTap(response);
    });
    
    console.log('✅ NotificationService: Notification listeners set up');
  }

  // Handle notification tap
  handleNotificationTap(response) {
    const data = response.notification.request.content.data;
    
    // Navigate based on notification type
    switch (data.type) {
      case 'comment':
        // Navigate to fit details
        // You'll need to implement navigation logic here
        break;
      case 'rating':
        // Navigate to fit details
        break;
      case 'new_fit':
        // Navigate to home feed
        break;
      default:
        break;
    }
  }

  // Save push token to user's Firestore document
  async savePushToken() {
    if (!this.expoPushToken || !auth.currentUser) {
      console.log('⚠️ NotificationService: Cannot save push token - missing token or user');
      console.log('Token:', this.expoPushToken ? 'Present' : 'Missing');
      console.log('User:', auth.currentUser ? 'Present' : 'Missing');
      return;
    }

    try {
      console.log('🔔 NotificationService: Saving push token to Firestore...');
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        pushToken: this.expoPushToken,
        updatedAt: new Date(),
      });
      console.log('✅ NotificationService: Push token saved to Firestore successfully');
    } catch (error) {
      console.error('❌ NotificationService: Error saving push token:', error);
    }
  }

  // Remove push token when user signs out
  async removePushToken() {
    if (!auth.currentUser) {
      console.log('⚠️ NotificationService: Cannot remove push token - no user');
      return;
    }

    try {
      console.log('🔔 NotificationService: Removing push token from Firestore...');
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        pushToken: null,
        updatedAt: new Date(),
      });
      console.log('✅ NotificationService: Push token removed from Firestore');
    } catch (error) {
      console.error('❌ NotificationService: Error removing push token:', error);
    }
  }

  // Test notification function
  async sendTestNotification() {
    if (!this.expoPushToken) {
      console.log('❌ NotificationService: No push token available for test');
      return false;
    }

    try {
      console.log('🔔 NotificationService: Sending test notification...');
      const message = {
        to: this.expoPushToken,
        sound: 'default',
        title: 'Test Notification',
        body: 'This is a test notification from FitCheck',
        data: { type: 'test' },
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        console.log('✅ NotificationService: Test notification sent successfully');
        return true;
      } else {
        console.error('❌ NotificationService: Test notification failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ NotificationService: Error sending test notification:', error);
      return false;
    }
  }

  // Send notification to specific user
  async sendNotificationToUser(userId, notificationData) {
    try {
      console.log('🔔 NotificationService: Sending notification to user:', userId);
      
      // Get user's push token
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        console.log('❌ NotificationService: User document does not exist:', userId);
        return;
      }

      const userData = userDoc.data();
      const pushToken = userData.pushToken;

      if (!pushToken) {
        console.log('❌ NotificationService: User has no push token:', userId);
        return;
      }

      console.log('🔔 NotificationService: User push token found:', pushToken.substring(0, 20) + '...');

      // Send push notification
      const success = await this.sendPushNotification(pushToken, notificationData);
      
      if (success) {
        // Save notification to database for history
        await this.saveNotificationToDatabase(userId, notificationData);
        console.log('✅ NotificationService: Notification sent and saved successfully');
      } else {
        console.log('❌ NotificationService: Failed to send push notification');
      }

    } catch (error) {
      console.error('❌ NotificationService: Error sending notification to user:', error);
    }
  }

  // Send push notification using Expo's push service
  async sendPushNotification(expoPushToken, notificationData) {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data || {},
    };

    try {
      console.log('🔔 NotificationService: Sending push notification:', {
        title: notificationData.title,
        body: notificationData.body,
        token: expoPushToken.substring(0, 20) + '...'
      });

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        console.log('✅ NotificationService: Push notification sent successfully');
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ NotificationService: Push notification failed:', response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ NotificationService: Error sending push notification:', error);
      return false;
    }
  }

  // Save notification to database for history
  async saveNotificationToDatabase(userId, notificationData) {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        type: notificationData.data?.type || 'general',
        title: notificationData.title,
        body: notificationData.body,
        data: notificationData.data || {},
        read: false,
        createdAt: new Date(),
      });
      console.log('✅ NotificationService: Notification saved to database');
    } catch (error) {
      console.error('❌ NotificationService: Error saving notification to database:', error);
    }
  }

  // Send comment notification
  async sendCommentNotification(fitId, commenterName, fitOwnerId) {
    if (fitOwnerId === auth.currentUser?.uid) {
      console.log('🔔 NotificationService: Skipping comment notification - commenting on own fit');
      return;
    }

    console.log('🔔 NotificationService: Sending comment notification:', {
      fitId,
      commenterName,
      fitOwnerId
    });

    // Check user's notification preferences
    try {
      const userDoc = await getDoc(doc(db, 'users', fitOwnerId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const preferences = userData.notificationPreferences || {};
        
        if (preferences.commentNotifications === false) {
          console.log('🔔 NotificationService: Comment notifications disabled for user:', fitOwnerId);
          return;
        }
      }
    } catch (error) {
      console.error('❌ NotificationService: Error checking notification preferences:', error);
    }

    const notificationData = {
      title: 'New Comment',
      body: `${commenterName} commented on your fit`,
      data: {
        type: 'comment',
        fitId,
        commenterName,
      },
    };

    await this.sendNotificationToUser(fitOwnerId, notificationData);
  }

  // Send rating notification (anonymous) with debouncing
  async sendRatingNotification(fitId, fitOwnerId, rating) {
    if (fitOwnerId === auth.currentUser?.uid) {
      console.log('🔔 NotificationService: Skipping rating notification - rating own fit');
      return;
    }

    console.log('🔔 NotificationService: Sending rating notification:', {
      fitId,
      fitOwnerId,
      rating
    });

    // Create unique key for this rater-fit combination (not fitOwner-fit)
    const raterId = auth.currentUser?.uid;
    const notificationKey = `${raterId}_${fitId}`;
    const now = Date.now();
    
    // Check if this specific rater recently rated this fit
    const lastNotificationTime = this.recentRatingNotifications.get(notificationKey);
    if (lastNotificationTime && (now - lastNotificationTime) < this.RATING_COOLDOWN_MS) {
      console.log('🔔 NotificationService: Rating notification skipped - cooldown period active for this rater');
      return;
    }

    // Check user's notification preferences
    try {
      const userDoc = await getDoc(doc(db, 'users', fitOwnerId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const preferences = userData.notificationPreferences || {};
        
        if (preferences.ratingNotifications === false) {
          console.log('🔔 NotificationService: Rating notifications disabled for user:', fitOwnerId);
          return;
        }
      }
    } catch (error) {
      console.error('❌ NotificationService: Error checking notification preferences:', error);
    }

    const notificationData = {
      title: 'New Rating',
      body: `Someone rated your fit ${rating}/5 stars`,
      data: {
        type: 'rating',
        fitId,
        rating,
      },
    };

    // Send notification and track it
    await this.sendNotificationToUser(fitOwnerId, notificationData);
    
    // Record this notification to prevent spam
    this.recentRatingNotifications.set(notificationKey, now);
    
    // Clean up old entries (older than 5 minutes) to prevent memory leaks
    setTimeout(() => {
      this.recentRatingNotifications.delete(notificationKey);
    }, 300000); // 5 minutes
  }

  // Send new fit notification to group members (single group)
  async sendNewFitNotification(fitId, fitOwnerName, groupId, groupName) {
    try {
      console.log('🔔 NotificationService: Sending new fit notification:', {
        fitId,
        fitOwnerName,
        groupId,
        groupName
      });

      // Get group members
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) {
        console.log('❌ NotificationService: Group document does not exist:', groupId);
        return;
      }

      const groupData = groupDoc.data();
      const members = groupData.members || [];

      // Send notification to all group members except the fit owner
      const fitOwnerId = auth.currentUser?.uid;
      const otherMembers = members.filter(memberId => memberId !== fitOwnerId);

      const notificationData = {
        title: 'New Fit Posted',
        body: `${fitOwnerName} posted a new fit in ${groupName}`,
        data: {
          type: 'new_fit',
          fitId,
          fitOwnerName,
          groupId,
          groupName,
        },
      };

      console.log('🔔 NotificationService: Sending to', otherMembers.length, 'group members');

      // Send to all other group members
      for (const memberId of otherMembers) {
        // Check user's notification preferences
        try {
          const userDoc = await getDoc(doc(db, 'users', memberId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const preferences = userData.notificationPreferences || {};
            
            if (preferences.newFitNotifications === false) {
              console.log('🔔 NotificationService: New fit notifications disabled for user:', memberId);
              continue;
            }
          }
        } catch (error) {
          console.error('❌ NotificationService: Error checking notification preferences:', error);
        }
        
        await this.sendNotificationToUser(memberId, notificationData);
      }

    } catch (error) {
      console.error('❌ NotificationService: Error sending new fit notifications:', error);
    }
  }

  // Send new fit notification to all groups with deduplication
  async sendNewFitNotificationToAllGroups(fitId, fitOwnerName, userGroups) {
    try {
      console.log('🔔 NotificationService: Sending new fit notification to all groups:', {
        fitId,
        fitOwnerName,
        groupCount: userGroups.length
      });

      const fitOwnerId = auth.currentUser?.uid;
      const notifiedUsers = new Set(); // Track users who have been notified
      
      // Batch fetch all group documents at once
      const groupPromises = userGroups.map(group => 
        getDoc(doc(db, 'groups', group.id))
      );
      const groupDocs = await Promise.all(groupPromises);
      
      // Collect all unique members from all groups
      for (const groupDoc of groupDocs) {
        if (!groupDoc.exists()) continue;

        const groupData = groupDoc.data();
        const members = groupData.members || [];
        
        // Add members to the set (automatically deduplicates)
        members.forEach(memberId => {
          if (memberId !== fitOwnerId) {
            notifiedUsers.add(memberId);
          }
        });
      }

      console.log(`🔔 NotificationService: Sending notifications to ${notifiedUsers.size} unique users`);

      // Batch fetch user preferences to reduce Firestore calls
      const userIds = Array.from(notifiedUsers);
      const userPromises = userIds.map(userId => 
        getDoc(doc(db, 'users', userId))
      );
      const userDocs = await Promise.all(userPromises);
      
      // Filter out users who have disabled notifications
      const usersToNotify = [];
      userDocs.forEach((userDoc, index) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const preferences = userData.notificationPreferences || {};
          
          if (preferences.newFitNotifications !== false) {
            usersToNotify.push(userIds[index]);
          }
        }
      });

      console.log(`🔔 NotificationService: Actually notifying ${usersToNotify.length} users (after preferences)`);

      // Send notifications in parallel with rate limiting
      const notificationData = {
        title: 'New Fit Posted',
        body: `${fitOwnerName} posted a new fit`,
        data: {
          type: 'new_fit',
          fitId,
          fitOwnerName,
        },
      };

      // Send notifications in batches to avoid overwhelming the system
      const batchSize = 5;
      for (let i = 0; i < usersToNotify.length; i += batchSize) {
        const batch = usersToNotify.slice(i, i + batchSize);
        const batchPromises = batch.map(userId => 
          this.sendNotificationToUser(userId, notificationData)
        );
        
        await Promise.all(batchPromises);
        
        // Small delay between batches to prevent rate limiting
        if (i + batchSize < usersToNotify.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

    } catch (error) {
      console.error('❌ NotificationService: Error sending new fit notifications:', error);
    }
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.initialized,
      hasToken: !!this.expoPushToken,
      token: this.expoPushToken,
      hasUser: !!auth.currentUser,
    };
  }

  // Clean up listeners
  cleanup() {
    console.log('🔔 NotificationService: Cleaning up notification listeners...');
    
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    
    this.initialized = false;
    console.log('✅ NotificationService: Cleanup complete');
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService; 