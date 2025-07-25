import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const { width, height } = Dimensions.get('window');

export default function NotificationsScreen({ isVisible, onClose, onNavigateToFit, onNotificationsOpened }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const backdropFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      showNotifications();
      fetchNotifications();
    } else {
      hideNotifications();
    }
  }, [isVisible]);

  const showNotifications = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Mark all notifications as read when opened
      markNotificationsAsRead();
      if (onNotificationsOpened) {
        onNotificationsOpened();
      }
    });
  };

  const hideNotifications = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const markNotificationsAsRead = async () => {
    if (!user || notifications.length === 0) return;

    try {
      // Generate notification IDs for all current notifications
      const notificationIds = notifications.map(notification => {
        return `${notification.fitId}_${notification.userId}_${notification.timestamp?.toDate?.()?.getTime() || notification.timestamp}`;
      });

      // Update user document to mark these notifications as read
      await updateDoc(doc(db, 'users', user.uid), {
        readNotificationIds: arrayUnion(...notificationIds)
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get all fits by the current user
      const userFitsQuery = query(
        collection(db, 'fits'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(userFitsQuery, async (snapshot) => {
        const userFits = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Collect all comments from user's fits
        const allNotifications = [];
        
        for (const fit of userFits) {
          if (fit.comments && Array.isArray(fit.comments)) {
            // Filter out comments by the user themselves
            const otherComments = fit.comments.filter(comment => 
              comment.userId !== user.uid
            );
            
            // Add fit context to each comment
            const notificationsWithContext = otherComments.map(comment => ({
              ...comment,
              fitId: fit.id,
              fitImageUrl: fit.imageURL,
              fitCaption: fit.caption,
              fitCreatedAt: fit.createdAt,
            }));
            
            allNotifications.push(...notificationsWithContext);
          }
        }

        // Sort by timestamp (most recent first)
        allNotifications.sort((a, b) => {
          const dateA = a.timestamp?.toDate?.() || new Date(a.timestamp);
          const dateB = b.timestamp?.toDate?.() || new Date(b.timestamp);
          return dateB - dateA;
        });

        setNotifications(allNotifications);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setLoading(false);
    }
  };

  const handleNotificationPress = (notification) => {
    hideNotifications();
    // Navigate to the specific fit
    if (onNavigateToFit) {
      onNavigateToFit(notification.fitId);
    }
  };

  // Swipe gesture functionality
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: slideAnim } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      
      if (translationX > width * 0.3) {
        // Swipe right - close notifications
        hideNotifications();
      } else {
        // Snap back to original position
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // Simple touch-based close functionality
  const handleBackdropPress = () => {
    hideNotifications();
  };

  const formatTimeAgo = (date) => {
    if (!date) return "Just now";
    
    const now = new Date();
    let commentDate;
    
    if (date.toDate && typeof date.toDate === 'function') {
      commentDate = date.toDate();
    } else if (date instanceof Date) {
      commentDate = date;
    } else {
      commentDate = new Date(date);
    }
    
    const diffInMinutes = Math.floor((now - commentDate) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return commentDate.toLocaleDateString();
  };

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.notificationContent}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {item.userProfileImageURL ? (
              <OptimizedImage 
                source={{ uri: item.userProfileImageURL }} 
                style={styles.avatarImage}
                showLoadingIndicator={false}
              />
            ) : (
              <Text style={styles.avatarText}>
                {(item.userName || "User").charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.textContent}>
            <Text style={styles.username}>{item.userName || "User"}</Text>
            <Text style={styles.commentText} numberOfLines={2}>
              {item.text}
            </Text>
            <Text style={styles.timestamp}>{formatTimeAgo(item.timestamp)}</Text>
          </View>
        </View>
        <View style={styles.fitPreview}>
          <OptimizedImage 
            source={{ uri: item.fitImageUrl }} 
            style={styles.fitImage}
            contentFit="cover"
            showLoadingIndicator={false}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-outline" size={32} color={theme.colors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptyText}>
        When someone comments on your fits, you'll see them here
      </Text>
    </View>
  );

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {/* Backdrop */}
      <Animated.View 
        style={[
          styles.backdrop,
          { opacity: backdropFadeAnim }
        ]}
      >
        <TouchableOpacity 
          style={styles.backdropTouchable}
          onPress={handleBackdropPress}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Notifications Panel */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.notificationsPanel,
            {
              transform: [{ translateX: slideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={hideNotifications}
            activeOpacity={0.8}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item, index) => `${item.fitId}_${item.id || index}`}
              renderItem={renderNotification}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouchable: {
    flex: 1,
  },
  notificationsPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  listContainer: {
    paddingVertical: 10,
  },
  notificationItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '700',
  },
  textContent: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  fitPreview: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    marginLeft: 12,
  },
  fitImage: {
    width: '100%',
    height: '100%',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 