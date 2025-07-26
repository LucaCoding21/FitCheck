import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, StatusBar, Modal, Animated, Dimensions, Animated as RNAnimated, PanGestureHandler, State, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';

const AnimatedFlatList = RNAnimated.createAnimatedComponent(FlatList);
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import FitCard from '../components/FitCard';
import FitCardSkeleton from '../components/FitCardSkeleton';
import CommentModal from '../components/CommentModal';
import NotificationsScreen from './NotificationsScreen';
import { theme } from '../styles/theme';
import OptimizedImage from '../components/OptimizedImage';
import PinnedWinnerCard from '../components/PinnedWinnerCard';
import Toast from 'react-native-toast-message';
// Removed deprecated winner calculation import - now handled by Cloud Functions

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation, route }) {
  const { user, signOutUser } = useAuth();
  const [fits, setFits] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all'); // 'all', 'kappa', 'thegirls', or group ID
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [stats, setStats] = useState({
    totalFits: 0,
    totalRatings: 0,
    averageFairRating: 0,
    groupsWithFits: 0
  });
  const [userProfileImageURL, setUserProfileImageURL] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [countdownText, setCountdownText] = useState('');
  
  // Comment modal state
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedFit, setSelectedFit] = useState(null);
  const [selectedComments, setSelectedComments] = useState([]);

  // Pagination state
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreFits, setHasMoreFits] = useState(true);
  const [lastVisibleFit, setLastVisibleFit] = useState(null);
  const [allFits, setAllFits] = useState([]); // Store all fits for filtering
  const [displayedFits, setDisplayedFits] = useState([]); // Currently displayed fits
  const [pageSize] = useState(10); // Number of fits to load per page

  // Cache state
  const [cachedFits, setCachedFits] = useState([]);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [cacheKey, setCacheKey] = useState(''); // Based on userGroups and selectedGroup

  // Focus listener state to prevent multiple registrations
  const focusListenerRegistered = useRef(false);
  const lastFocusTime = useRef(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Cache validation functions
  const generateCacheKey = useCallback(() => {
    const groupIds = userGroups.map(g => g.id).sort().join(',');
    return `${groupIds}_${selectedGroup}`;
  }, [userGroups, selectedGroup]);

  const isCacheValid = useCallback(() => {
    const currentTime = Date.now();
    const cacheAge = currentTime - lastFetchTime;
    const maxCacheAge = 5 * 60 * 1000; // 5 minutes
    
    // Check if cache is still fresh and cache key matches
    return cacheAge < maxCacheAge && cacheKey === generateCacheKey();
  }, [lastFetchTime, cacheKey, generateCacheKey]);

  const shouldUseCache = useCallback(() => {
    return cachedFits.length > 0 && isCacheValid();
  }, [cachedFits.length, isCacheValid]);

  const invalidateCache = useCallback(() => {
    setCachedFits([]);
    setLastFetchTime(0);
    setCacheKey('');
  }, []);

  // FlatList ref for scrolling
  const flatListRef = useRef(null);

  // Entrance animation values (native driver)
  const entranceFadeAnim = useRef(new Animated.Value(0)).current;
  const entranceSlideAnim = useRef(new Animated.Value(50)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;
  


  // Calculate time until midnight
  const calculateTimeUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0); // Next midnight
    
    const diff = midnight - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  useEffect(() => {
    // Lighter entrance animations for better performance
    Animated.parallel([
      Animated.timing(entranceFadeAnim, {
        toValue: 1,
        duration: 300, // Further reduced for better performance
        useNativeDriver: true,
      }),
      Animated.timing(entranceSlideAnim, {
        toValue: 0,
        duration: 250, // Further reduced for better performance
        useNativeDriver: true,
      }),
      Animated.spring(titleScale, {
        toValue: 1,
        tension: 100, // Increased for faster animation
        friction: 4, // Reduced for less damping
        useNativeDriver: true,
      }),
    ]).start();

    // Critical data fetch first
    fetchUserGroups();
    
    // Defer non-critical operations with shorter delays
    const profileTimer = setTimeout(() => {
      fetchUserProfile();
    }, 200); // Reduced delay
    
    // Defer notification count - much longer delay to prevent blocking
    const notificationTimer = setTimeout(() => {
      fetchUnreadNotificationsCount();
    }, 3000); // Much longer delay to prevent blocking transitions
    
    // Daily winner calculation now handled automatically by Cloud Functions
    // No manual calculation needed
    
    // Initialize countdown
    setCountdownText(calculateTimeUntilMidnight());
    
    // Update countdown every minute
    const countdownInterval = setInterval(() => {
      setCountdownText(calculateTimeUntilMidnight());
    }, 60000); // Update every minute
    
    return () => {
      clearInterval(countdownInterval);
      clearTimeout(profileTimer);
      clearTimeout(notificationTimer);
      // No winner timer to clear - handled by Cloud Functions
    };
  }, []);

  // Enhanced focus listener to handle new posts
  useEffect(() => {
    if (focusListenerRegistered.current) return;
    
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('🔄 HomeScreen: Focus listener triggered');
      
      // Check if we just posted a fit and need to refresh
      if (global.justPostedFit || global.triggerSkeletonLoading) {
        console.log('🔄 HomeScreen: New post detected on focus, refreshing...');
        global.justPostedFit = false;
        global.triggerSkeletonLoading = false;
        
        // Set transitioning flag to show skeleton loading
        setIsTransitioning(true);
        
        // Refresh data after a short delay to ensure smooth transition
        setTimeout(() => {
          if (userGroups.length > 0) {
            setIsTransitioning(false);
            fetchTodaysFits(false, true);
          }
        }, 500);
      }
    });

    focusListenerRegistered.current = true;
    
    return unsubscribeFocus;
  }, [navigation, userGroups]);

  useEffect(() => {
    // Don't do anything during transitions
    if (isTransitioning) {
      return;
    }
    
    if (userGroups.length > 0) {
      // Check if we have valid cached data first - immediate check
      if (shouldUseCache()) {
        // Update all states immediately to prevent loading delay
        setAllFits(cachedFits);
        const initialFits = cachedFits.slice(0, pageSize);
        setDisplayedFits(initialFits);
        setLastVisibleFit(initialFits[initialFits.length - 1] || null);
        setHasMoreFits(cachedFits.length > pageSize);
        setLoading(false); // Ensure loading is false
      } else {
        // Only fetch if no valid cache - defer to prevent blocking
        setTimeout(() => {
          fetchTodaysFits();
        }, 100);
      }
    }
  }, [userGroups, selectedGroup]);

  // Single, clean skeleton loading trigger
  useEffect(() => {
    if (global.triggerSkeletonLoading) {
      console.log('🔄 HomeScreen: Starting skeleton loading...');
      global.triggerSkeletonLoading = false;
      
      // Set transitioning flag to show skeleton loading IMMEDIATELY
      setIsTransitioning(true);
      
      // Show skeleton loading for 800ms, then refresh smoothly
      setTimeout(() => {
        console.log('🔄 HomeScreen: Skeleton loading complete, refreshing data...');
        setIsTransitioning(false);
        // Force refresh to show new post
        if (userGroups.length > 0) {
          fetchTodaysFits(false, true);
        }
      }, 800); // Slightly longer for smoother feel
    }
  }, []); // Run on mount and when trigger changes

  // ALSO check for justPostedFit flag immediately with polling
  useEffect(() => {
    const checkForNewPost = () => {
      if (global.justPostedFit || global.triggerSkeletonLoading) {
        console.log('🔄 HomeScreen: New post detected, showing skeleton immediately');
        global.justPostedFit = false;
        global.triggerSkeletonLoading = false;
        
        // Set transitioning flag to show skeleton loading IMMEDIATELY
        setIsTransitioning(true);
        
        // Wait for userGroups to be available, then refresh
        const waitForUserGroups = () => {
          if (userGroups.length > 0) {
            console.log('🔄 HomeScreen: UserGroups available, refreshing data...');
            setIsTransitioning(false);
            setLoading(true);
            console.log('🔄 HomeScreen: Calling fetchTodaysFits with forceRefresh=true');
            fetchTodaysFits(false, true);
          } else {
            console.log('🔄 HomeScreen: Waiting for userGroups...');
            setTimeout(waitForUserGroups, 100);
          }
        };
        
        // Start waiting after 800ms skeleton time
        setTimeout(waitForUserGroups, 800);
      }
    };

    // Check immediately
    checkForNewPost();
    
    // Poll every 10ms to catch it as fast as possible
    const interval = setInterval(checkForNewPost, 10);
    
    return () => clearInterval(interval);
  }, [userGroups]); // Run on mount AND when userGroups changes

  // Midnight reset - winners now calculated automatically by Cloud Functions
  useEffect(() => {
    const checkForMidnightReset = () => {
      const now = new Date();
      // Check if it's between 12:00 AM and 12:05 AM to catch midnight
      if (now.getHours() === 0 && now.getMinutes() < 5) {
        // It's midnight - refresh feed to show new day
        if (userGroups.length > 0) {
          console.log('🕛 Midnight detected - refreshing feed for new day...');
          // Invalidate cache to refresh the feed
          invalidateCache();
          // Refresh the feed to show new day
          fetchTodaysFits(false, true);
        }
      }
    };
    
    // Check every minute for midnight
    const interval = setInterval(checkForMidnightReset, 60000);
    return () => clearInterval(interval);
  }, [userGroups]);

  // Remove the complex toast and scroll handling that was causing lag
  // The toast is now handled directly in PostFitScreen


  const fetchUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfileImageURL(userData.profileImageURL || null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchUnreadNotificationsCount = async () => {
    if (!user) return;

    try {
      // Get user's read notifications from their profile first
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      const readNotificationIds = userData?.readNotificationIds || [];

      // Get all fits by the current user with one-time query
      const userFitsQuery = query(
        collection(db, 'fits'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(userFitsQuery);
      const userFits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Count unread notifications more efficiently
      let unreadCount = 0;
      
      for (const fit of userFits) {
        if (fit.comments && Array.isArray(fit.comments)) {
          // Count comments by others that haven't been read
          const unreadComments = fit.comments.filter(comment => {
            if (comment.userId === user.uid) return false; // Skip own comments
            
            const notificationId = `${fit.id}_${comment.userId}_${comment.timestamp?.toDate?.()?.getTime() || comment.timestamp}`;
            return !readNotificationIds.includes(notificationId);
          });
          
          unreadCount += unreadComments.length;
        }
      }

      setUnreadNotificationsCount(unreadCount);

    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
    }
  };

  const fetchUserGroups = async () => {
    try {
      const groupsQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(groupsQuery);
      const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserGroups(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchTodaysFits = async (loadMore = false, forceRefresh = false) => {
    console.log(`🔄 HomeScreen: fetchTodaysFits called - loadMore: ${loadMore}, forceRefresh: ${forceRefresh}`);
    
    if (userGroups.length === 0) {
      console.log('🔄 HomeScreen: No userGroups available, returning early');
      return;
    }

    // Check cache first (unless force refresh or loading more)
    if (!forceRefresh && !loadMore && shouldUseCache()) {
      console.log('🔄 HomeScreen: Using cached fits data');
      setAllFits(cachedFits);
      const initialFits = cachedFits.slice(0, pageSize);
      setDisplayedFits(initialFits);
      setLastVisibleFit(initialFits[initialFits.length - 1] || null);
      setHasMoreFits(cachedFits.length > pageSize);
      return;
    }

    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setAllFits([]);
        setDisplayedFits([]);
        setLastVisibleFit(null);
        setHasMoreFits(true);
      }

      // Get all group IDs the user belongs to
      const userGroupIds = userGroups.map(group => group.id);
      
      // Create today's date range for server-side filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Use one-time query with server-side date filtering instead of onSnapshot
      const fitsQuery = query(
        collection(db, 'fits'),
        where('groupIds', 'array-contains-any', userGroupIds),
        where('createdAt', '>=', today),
        where('createdAt', '<', tomorrow),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(fitsQuery);
      
      let fitsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Store all fits without filtering - we'll apply client-side filtering
      // This allows for instant filter switching without refetching

      // Update cache
      setCachedFits(fitsData);
      setLastFetchTime(Date.now());
      setCacheKey(generateCacheKey());

      // Update all fits for filtering
      setAllFits(fitsData);
      
      // Handle pagination with client-side filtering
      if (loadMore) {
        // Load more fits - this will be handled by loadMoreFits function
        // which now works with client-side filtering
        setLoadingMore(false);
      } else {
        // Initial load - apply current filter to all fits
        let filteredFits;
        
        if (selectedGroup === 'all') {
          filteredFits = fitsData;
        } else {
          filteredFits = fitsData.filter(fit => 
            fit.groupIds && fit.groupIds.includes(selectedGroup)
          );
        }
        
        const initialFits = filteredFits.slice(0, pageSize);
        setDisplayedFits(initialFits);
        setLastVisibleFit(initialFits[initialFits.length - 1] || null);
        setHasMoreFits(filteredFits.length > pageSize);
        
        // Scroll to top if this was a force refresh (new post)
        if (forceRefresh && flatListRef.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 100);
        }
      }
      
      setLoading(false);
      setLoadingMore(false);
      
      // Defer stats calculation to avoid blocking UI - much longer delay
      setTimeout(() => {
        calculateStats(fitsData);
      }, 2000); // Increased delay to prevent UI blocking

    } catch (error) {
      console.error("Error fetching fits:", error);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const calculateStats = (fitsData) => {
    const totalFits = fitsData.length;
    const totalRatings = fitsData.reduce((sum, fit) => sum + (fit.ratingCount || 0), 0);
    const averageFairRating = fitsData.length > 0 
      ? fitsData.reduce((sum, fit) => sum + (fit.fairRating || 0), 0) / fitsData.length 
      : 0;
    const groupsWithFits = new Set(fitsData.flatMap(fit => fit.groupIds || [])).size;

    setStats({
      totalFits,
      totalRatings,
      averageFairRating,
      groupsWithFits
    });
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOutUser();
              // Navigation will be handled automatically by App.js when user becomes null
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleGroupSelect = (group) => {
    // Handle both string IDs and group objects
    const groupId = typeof group === 'string' ? group : group.id;
    
    // Don't do anything if selecting the same group
    if (selectedGroup === groupId) {
      return;
    }
    
    setSelectedGroup(groupId);
    
    // Apply client-side filtering for instant response
    if (allFits.length > 0) {
      let filteredFits;
      
      if (groupId === 'all') {
        // Show all fits from user's groups
        filteredFits = allFits;
      } else {
        // Filter fits for the selected group
        filteredFits = allFits.filter(fit => 
          fit.groupIds && fit.groupIds.includes(groupId)
        );
      }
      
      // Update displayed fits with pagination
      const initialFits = filteredFits.slice(0, pageSize);
      setDisplayedFits(initialFits);
      setLastVisibleFit(initialFits[initialFits.length - 1] || null);
      setHasMoreFits(filteredFits.length > pageSize);
      
      // Update stats for the filtered data
      calculateStats(filteredFits);
    }
    
    // Only invalidate cache if we don't have data yet
    if (allFits.length === 0) {
      invalidateCache();
      fetchTodaysFits(false, false);
    }
  };

  const loadMoreFits = () => {
    if (!loadingMore && hasMoreFits) {
      // Get the current filtered fits based on selected group
      let filteredFits;
      
      if (selectedGroup === 'all') {
        filteredFits = allFits;
      } else {
        filteredFits = allFits.filter(fit => 
          fit.groupIds && fit.groupIds.includes(selectedGroup)
        );
      }
      
      // Load more from the filtered data
      const startIndex = displayedFits.length;
      const endIndex = startIndex + pageSize;
      const newFits = filteredFits.slice(startIndex, endIndex);
      
      if (newFits.length > 0) {
        setDisplayedFits(prev => [...prev, ...newFits]);
        setLastVisibleFit(newFits[newFits.length - 1]);
        setHasMoreFits(endIndex < filteredFits.length);
      } else {
        setHasMoreFits(false);
      }
    }
  };

  const handleAddGroup = () => {
    navigation.navigate('Groups');
  };

  const handleNotificationPress = () => {
    setShowNotifications(true);
  };

  const handleNotificationsOpened = () => {
    // Clear unread count when notifications are opened
    setUnreadNotificationsCount(0);
  };

  const handleCloseNotifications = () => {
    setShowNotifications(false);
  };

  const handleNavigateToFit = (fitId) => {
    // Navigate to FitDetailsScreen instead of scrolling to fit
    navigation.navigate('FitDetails', { fitId: fitId });
  };



  const handleScroll = (event) => {
    // Simple scroll handler - no header animation
    // Just for logging or future use
  };

  const handleCommentSectionOpen = (fitId) => {
    // Comment section opened - no auto-scroll needed
    // User can manually scroll if they want to see the fit
  };

  const handleOpenCommentModal = (fit, comments) => {
    setSelectedFit(fit);
    setSelectedComments(comments || []);
    setShowCommentModal(true);
  };

  const handleCloseCommentModal = () => {
    setShowCommentModal(false);
    setSelectedFit(null);
    setSelectedComments([]);
  };

  const handleCommentAdded = (newComment) => {
    // Update the selected comments when a new comment is added
    if (selectedFit && selectedComments) {
      setSelectedComments([...selectedComments, newComment]);
    }
  };

  const handlePinnedWinnerPress = useCallback(() => {
    // Navigate to FitDetailsScreen with the winner's fit
    // This will be handled by the PinnedWinnerCard component
  }, []);

  // Manual trigger for testing winner calculation




  const renderGroupButton = (group, isSelected, key) => {
    const isAllGroup = group === 'all';
    const isAddButton = group === 'add';
    
    if (isAddButton) {
      return (
        <TouchableOpacity
          key="add"
          style={styles.addGroupButton}
          onPress={handleAddGroup}
          activeOpacity={0.8}
        >
          <Text style={styles.addGroupIcon}>+</Text>
        </TouchableOpacity>
        );
    }

    const handlePress = () => {
      handleGroupSelect(group);
    };

    return (
      <TouchableOpacity
        key={key || group}
        style={[
          styles.groupButton,
          isSelected && styles.groupButtonSelected
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.groupButtonContent}>
          <Text style={[
            styles.groupButtonText,
            isSelected && styles.groupButtonTextSelected
          ]}>
            {isAllGroup ? 'All' : (typeof group === 'string' ? group : group.name)}
          </Text>
          {/* Streak Badge */}
          {!isAllGroup && group.streak > 0 && (
            <View style={[
              styles.streakBadge,
              isSelected && styles.streakBadgeSelected
            ]}>
              <Ionicons name="flame" size={12} color={isSelected ? "#FFFFFF" : "#FF6B35"} />
              <Text style={[
                styles.streakCount,
                isSelected && styles.streakCountSelected
              ]}>
                {group.streak}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Memoize the PinnedWinnerCard component to prevent unnecessary re-renders
  const memoizedPinnedWinnerCard = useMemo(() => (
    <PinnedWinnerCard 
      key={`winner-${selectedGroup}`}
      onPress={handlePinnedWinnerPress}
      navigation={navigation}
      selectedGroup={selectedGroup}
      userGroups={userGroups}
    />
  ), [selectedGroup, userGroups]); // Depend on selectedGroup and userGroups

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: entranceFadeAnim,
            transform: [{ translateY: entranceSlideAnim }],
          },
        ]}
      >
        {/* Top Header Row */}
        <View style={styles.headerTop}>
          <Text style={styles.feedTitle}>Feed</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={handleNotificationPress}
              activeOpacity={0.8}
            >
              <OptimizedImage 
                source={require('../../assets/noti.png')} 
                style={styles.notificationIcon}
                showLoadingIndicator={false}
              />
              {unreadNotificationsCount > 0 && (
                <View style={styles.notificationDot} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              {userProfileImageURL ? (
                <OptimizedImage 
                  source={{ uri: userProfileImageURL }} 
                  style={styles.profileImage}
                  showLoadingIndicator={false}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={24} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Groups Section */}
        <View style={styles.groupsSection}>
          <Text style={styles.groupsTitle}>Feed resets in {countdownText}</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupsContainer}
            style={styles.groupsScrollView}
          >
            {renderGroupButton('all', selectedGroup === 'all')}
            {userGroups.map(group => 
              renderGroupButton(group, selectedGroup === group.id, group.id)
            )}
            {renderGroupButton('add')}
          </ScrollView>
        </View>
      </Animated.View>
      
      {/* Content Container */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: entranceFadeAnim,
            transform: [{ translateY: entranceSlideAnim }],
            paddingTop: 200, // Fixed padding for header space
          },
        ]}
      >
        {userGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>👥</Text>
            </View>
            <Text style={styles.emptyText}>Join a group to get started</Text>
            <Text style={styles.emptySubtext}>
              Connect with friends and start rating fits together
            </Text>
            <TouchableOpacity 
              style={styles.joinGroupButton}
              onPress={() => navigation.navigate('Groups')}
              activeOpacity={0.8}
            >
              <View style={styles.joinGroupContainer}>
                <Text style={styles.joinGroupText}>Create or Join Group</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {isTransitioning || global.justPostedFit || global.triggerSkeletonLoading || (loading && displayedFits.length === 0) ? (
              // Show skeleton loading when transitioning OR when flags are set OR when loading with no data
              <View style={styles.skeletonContainer}>
                <FitCardSkeleton />
                <FitCardSkeleton />
                <FitCardSkeleton />
              </View>
            ) : displayedFits.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <OptimizedImage 
                    source={require('../../assets/starman-whitelegs.png')} 
                    style={styles.emptyIconImage}
                    showLoadingIndicator={false}
                  />
                </View>
                <Text style={styles.emptyTitle}>No Fits Today</Text>
                <Text style={styles.emptyText}>
                  Be the first to drop your fit and start the daily feed
                </Text>
              </View>
            ) : (
              <AnimatedFlatList
                ref={flatListRef}
                data={displayedFits}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => {
                  if (isTransitioning) {
                    console.log('🔄 HomeScreen: Rendering skeleton for index:', index);
                    return <FitCardSkeleton />;
                  } else {
                    return (
                      <FitCard 
                        fit={item} 
                        onCommentSectionOpen={handleCommentSectionOpen}
                        onOpenCommentModal={handleOpenCommentModal}
                      />
                    );
                  }
                }}
                ListHeaderComponent={memoizedPinnedWinnerCard}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedContainer}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                onEndReached={loadMoreFits}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => loadingMore ? (
                  <View style={styles.loadingMoreContainer}>
                    <ActivityIndicator size="small" color="#B5483D" />
                  </View>
                ) : null}
              />
            )}
          </>
        )}
      </Animated.View>

      {/* Notifications Screen */}
      <NotificationsScreen
        isVisible={showNotifications}
        onClose={handleCloseNotifications}
        onNavigateToFit={handleNavigateToFit}
        onNotificationsOpened={handleNotificationsOpened}
      />

      {/* Comment Modal */}
      <CommentModal
        isVisible={showCommentModal}
        onClose={handleCloseCommentModal}
        fit={selectedFit}
        comments={selectedComments}
        onCommentAdded={handleCommentAdded}
      />
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  
  // Header styles
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },


  notificationButton: {
    width: 30,
    height: 30,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    width: 35,
    height: 35,
    tintColor: '#FFFFFF',
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#121212',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePlaceholderText: {
    fontSize: 16,
    color: '#FFFFFF',
  },


  // Groups section
  groupsSection: {
    marginBottom: 8,
  },
  groupsTitle: {
    fontSize: 16,
    color: '#6C6C6C',
    marginBottom: 21,
    opacity: 0.8,
  },
  groupsScrollView: {
    flexGrow: 0,
  },
  groupsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 20, // Add padding to ensure last item is fully visible
  },
  groupButton: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  groupButtonSelected: {
    backgroundColor: '#7b362f',
    borderColor: '#b5493e',
  },
  groupButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  groupButtonTextSelected: {
    fontWeight: '600',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  streakBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  streakCount: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: '600',
  },
  streakCountSelected: {
    color: '#FFFFFF',
  },
  addGroupButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  addGroupIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  
  // Content styles
  contentContainer: {
    flex: 1,
    paddingHorizontal: 7,
  },
  feedContainer: {
    paddingTop: 7,
    paddingBottom: 100,

  },
  
  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
    marginTop: 10,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyIconImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  joinGroupButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  joinGroupContainer: {
    backgroundColor: '#B5483D',
    paddingHorizontal: 32,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinGroupText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    color: '#CCCCCC',
    fontSize: 16,
  },
  skeletonContainer: {
    flex: 1,
    paddingTop: 7,
    paddingBottom: 100,
  },
});