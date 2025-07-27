import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, arrayUnion, startAfter } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const { width, height } = Dimensions.get('window');
const NOTIFICATIONS_PER_PAGE = 5; // Reduced from 8 to 5 for faster initial load

export default function NotificationsScreen({ isVisible, onClose, onNavigateToFit, onNotificationsOpened }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const backdropFadeAnim = useRef(new Animated.Value(0)).current;

  // Cache for notifications to avoid re-fetching
  const notificationsCache = useRef(new Map()).current;

  useEffect(() => {
    if (isVisible) {
      // Show animation immediately, load data in background
      showNotifications();
      // Small delay to let animation start first
      setTimeout(() => {
        if (isInitialLoad) {
          fetchNotifications();
        }
      }, 50);
    } else {
      hideNotifications();
    }
  }, [isVisible]);

  // Cache notifications between opens - store processed notifications directly
  const cachedNotifications = useRef([]);
  const cachedLastDoc = useRef(null);
  const cachedHasMore = useRef(true);
  const isUsingCache = useRef(false);

  const showNotifications = () => {
    // Super fast animation - no heavy operations
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 100, // Super fast
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100, // Super fast
        useNativeDriver: true,
      }),
      Animated.timing(backdropFadeAnim, {
        toValue: 1,
        duration: 100, // Super fast
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Only call the callback, don't do heavy operations here
      if (onNotificationsOpened) {
        onNotificationsOpened();
      }
    });
  };

  const hideNotifications = () => {
    // Cache current state before closing - only if we have notifications
    if (notifications.length > 0) {
      // Limit cache to prevent memory buildup - only keep last 20 notifications
      const limitedNotifications = notifications.slice(0, 20);
      cachedNotifications.current = [...limitedNotifications]; // Create a copy
      cachedLastDoc.current = lastDoc;
      cachedHasMore.current = hasMore;
      isUsingCache.current = false; // Reset cache flag
    }
    
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 150, // Even faster animation
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150, // Even faster animation
        useNativeDriver: true,
      }),
      Animated.timing(backdropFadeAnim, {
        toValue: 0,
        duration: 150, // Even faster animation
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  // Move markNotificationsAsRead to a separate effect that runs after data loads
  useEffect(() => {
    // Only mark as read if we're not using cached data and have notifications
    if (notifications.length > 0 && !loading && isVisible && !isUsingCache.current) {
      // Much longer delay to ensure UI is fully ready and not blocking
      const timer = setTimeout(() => {
        markNotificationsAsRead();
      }, 1000); // Much longer delay to prevent blocking
      return () => clearTimeout(timer);
    }
  }, [notifications.length, loading, isVisible]);

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

  const fetchNotifications = useCallback(async (loadMore = false) => {
    if (!user) return;

    // If we have cached data and not loading more, use it immediately
    if (!loadMore && cachedNotifications.current.length > 0 && cachedNotifications.current.length <= 30) {
      setNotifications(cachedNotifications.current);
      setLastDoc(cachedLastDoc.current);
      setHasMore(cachedHasMore.current);
      setIsInitialLoad(false);
      isUsingCache.current = true; // Mark that we're using cache
      return;
    }

    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      // Calculate date 3 days ago for filtering
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0);

      // Build query with pagination - only 5 items for faster loading
      // Only get fits from last 3 days to reduce data load
      let userFitsQuery = query(
        collection(db, 'fits'),
        where('userId', '==', user.uid),
        where('createdAt', '>=', threeDaysAgo),
        orderBy('createdAt', 'desc'),
        limit(NOTIFICATIONS_PER_PAGE)
      );

      // Add startAfter for pagination
      if (loadMore && lastDoc) {
        userFitsQuery = query(
          collection(db, 'fits'),
          where('userId', '==', user.uid),
          where('createdAt', '>=', threeDaysAgo),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(NOTIFICATIONS_PER_PAGE)
        );
      }

      const snapshot = await getDocs(userFitsQuery);
      
      // Check if there are more documents
      setHasMore(snapshot.docs.length === NOTIFICATIONS_PER_PAGE);
      
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }

      const userFits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Process notifications from fits - moved to separate function for better performance
      const newNotifications = processFitsToNotifications(userFits, user.uid);

      // Update notifications state
      if (loadMore) {
        setNotifications(prev => [...prev, ...newNotifications]);
      } else {
        setNotifications(newNotifications);
      }

      setIsInitialLoad(false);
      isUsingCache.current = false; // Mark that we're not using cache for fresh data
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, lastDoc]);

  // Simple function to process fits into notifications
  const processFitsToNotifications = useCallback((userFits, userId) => {
    const newNotifications = [];
    
    for (const fit of userFits) {
      if (fit.comments && Array.isArray(fit.comments)) {
        // Filter out comments by the user themselves
        const otherComments = fit.comments.filter(comment => 
          comment.userId !== userId
        );
        
        // Add fit context to each comment
        const notificationsWithContext = otherComments.map(comment => ({
          ...comment,
          fitId: fit.id,
          fitImageUrl: fit.imageURL,
          fitCaption: fit.caption,
          fitCreatedAt: fit.createdAt,
        }));
        
        newNotifications.push(...notificationsWithContext);
      }
    }

    return newNotifications;
  }, []);

  const loadMoreNotifications = useCallback(() => {
    if (hasMore && !loadingMore) {
      fetchNotifications(true);
    }
  }, [hasMore, loadingMore, fetchNotifications]);

  // Clear cache when needed (e.g., when new notifications might have been added)
  const clearCache = useCallback(() => {
    cachedNotifications.current = [];
    cachedLastDoc.current = null;
    cachedHasMore.current = true;
    isUsingCache.current = false;
    setIsInitialLoad(true);
  }, []);

  // Clear cache periodically to prevent memory buildup
  useEffect(() => {
    const cacheCleanupInterval = setInterval(() => {
      if (cachedNotifications.current.length > 50) {
        console.log('🧹 Clearing notification cache to prevent memory buildup');
        clearCache();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(cacheCleanupInterval);
      // Clear cache on unmount to prevent memory leaks
      clearCache();
    };
  }, [clearCache]);

  const handleNotificationPress = (notification) => {
    hideNotifications();
    // Navigate to the specific fit
    if (onNavigateToFit) {
      onNavigateToFit(notification.fitId);
    }
  };

  // Swipe gesture functionality
  const onGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: (x) => {
            // Only allow positive (rightward) translation
            if (x > 0) {
              slideAnim.setValue(x);
            } else {
              slideAnim.setValue(0);
            }
          },
        },
      },
    ],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      // Only allow closing if swiped right
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

  const formatTimeAgo = useCallback((date) => {
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
  }, []);

  const renderNotification = useCallback(({ item }) => (
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
                priority="low"
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
            priority="low"
          />
        </View>
      </View>
    </TouchableOpacity>
  ), [handleNotificationPress, formatTimeAgo]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="notifications-outline" size={32} color={theme.colors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptyText}>
        When someone comments on your fits, you'll see them here
      </Text>
    </View>
  ), []);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  }, [loadingMore]);

  const keyExtractor = useCallback((item, index) => 
    `${item.fitId}_${item.id || index}`, []);

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
        activeOffsetX={0} // Only allow rightward swipes
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
          {loading && notifications.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : notifications.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={keyExtractor}
              renderItem={renderNotification}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              onEndReached={loadMoreNotifications}
              onEndReachedThreshold={0.3}
              ListFooterComponent={renderFooter}
              removeClippedSubviews={true}
              maxToRenderPerBatch={2}
              windowSize={3}
              initialNumToRender={3}
              getItemLayout={(data, index) => ({
                length: 82, // Height of notification item
                offset: 82 * index,
                index,
              })}
              scrollEventThrottle={16}
              decelerationRate="fast"
              bounces={false}
              updateCellsBatchingPeriod={50}
              disableVirtualization={false}
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
    marginTop: 12,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
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