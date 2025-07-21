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
  }

  // Initialize notification service
  async initialize() {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return false;
      }

      // Get push token
      if (Device.isDevice) {
        this.expoPushToken = (await Notifications.getExpoPushTokenAsync({
          projectId: 'f2827a96-31a7-42b8-978a-3f54697a207d',
        })).data;
        console.log('Expo push token:', this.expoPushToken);
      } else {
        console.log('Must use physical device for Push Notifications');
      }

      // Set up notification listeners
      this.setupNotificationListeners();

      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  // Set up notification listeners
  setupNotificationListeners() {
    // Listen for incoming notifications
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listen for notification responses (when user taps notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Handle notification tap - navigate to appropriate screen
      this.handleNotificationTap(response);
    });
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
    if (!this.expoPushToken || !auth.currentUser) return;

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        pushToken: this.expoPushToken,
        updatedAt: new Date(),
      });
      console.log('Push token saved to Firestore');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  // Remove push token when user signs out
  async removePushToken() {
    if (!auth.currentUser) return;

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        pushToken: null,
        updatedAt: new Date(),
      });
      console.log('Push token removed from Firestore');
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }

  // Send notification to specific user
  async sendNotificationToUser(userId, notificationData) {
    try {
      // Get user's push token
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const pushToken = userData.pushToken;

      if (!pushToken) {
        console.log('User has no push token');
        return;
      }

      // Send push notification
      await this.sendPushNotification(pushToken, notificationData);

      // Save notification to database for history
      await this.saveNotificationToDatabase(userId, notificationData);

    } catch (error) {
      console.error('Error sending notification to user:', error);
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
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      console.log('Push notification sent successfully');
    } catch (error) {
      console.error('Error sending push notification:', error);
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
    } catch (error) {
      console.error('Error saving notification to database:', error);
    }
  }

  // Send comment notification
  async sendCommentNotification(fitId, commenterName, fitOwnerId) {
    if (fitOwnerId === auth.currentUser?.uid) return; // Don't notify yourself

    // Check user's notification preferences
    try {
      const userDoc = await getDoc(doc(db, 'users', fitOwnerId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const preferences = userData.notificationPreferences || {};
        
        if (preferences.commentNotifications === false) {
          console.log('Comment notifications disabled for user');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking notification preferences:', error);
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
    if (fitOwnerId === auth.currentUser?.uid) return; // Don't notify yourself

    // Create unique key for this rater-fit combination (not fitOwner-fit)
    const raterId = auth.currentUser?.uid;
    const notificationKey = `${raterId}_${fitId}`;
    const now = Date.now();
    
    // Check if this specific rater recently rated this fit
    const lastNotificationTime = this.recentRatingNotifications.get(notificationKey);
    if (lastNotificationTime && (now - lastNotificationTime) < this.RATING_COOLDOWN_MS) {
      console.log('Rating notification skipped - cooldown period active for this rater');
      return;
    }

    // Check user's notification preferences
    try {
      const userDoc = await getDoc(doc(db, 'users', fitOwnerId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const preferences = userData.notificationPreferences || {};
        
        if (preferences.ratingNotifications === false) {
          console.log('Rating notifications disabled for user');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking notification preferences:', error);
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
      // Get group members
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (!groupDoc.exists()) return;

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

      // Send to all other group members
      for (const memberId of otherMembers) {
        // Check user's notification preferences
        try {
          const userDoc = await getDoc(doc(db, 'users', memberId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const preferences = userData.notificationPreferences || {};
            
            if (preferences.newFitNotifications === false) {
              console.log('New fit notifications disabled for user:', memberId);
              continue;
            }
          }
        } catch (error) {
          console.error('Error checking notification preferences:', error);
        }
        
        await this.sendNotificationToUser(memberId, notificationData);
      }

    } catch (error) {
      console.error('Error sending new fit notifications:', error);
    }
  }

  // Send new fit notification to all groups with deduplication
  async sendNewFitNotificationToAllGroups(fitId, fitOwnerName, userGroups) {
    try {
      const fitOwnerId = auth.currentUser?.uid;
      const notifiedUsers = new Set(); // Track users who have been notified
      
      // Collect all unique members from all groups
      for (const group of userGroups) {
        const groupDoc = await getDoc(doc(db, 'groups', group.id));
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

      console.log(`Sending notifications to ${notifiedUsers.size} unique users`);

      // Send one notification per unique user
      for (const userId of notifiedUsers) {
        // Check user's notification preferences
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const preferences = userData.notificationPreferences || {};
            
            if (preferences.newFitNotifications === false) {
              console.log('New fit notifications disabled for user:', userId);
              continue;
            }
          }
        } catch (error) {
          console.error('Error checking notification preferences:', error);
        }

        const notificationData = {
          title: 'New Fit Posted',
          body: `${fitOwnerName} posted a new fit`,
          data: {
            type: 'new_fit',
            fitId,
            fitOwnerName,
          },
        };

        await this.sendNotificationToUser(userId, notificationData);
      }

    } catch (error) {
      console.error('Error sending new fit notifications:', error);
    }
  }

  // Clean up listeners
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService; 