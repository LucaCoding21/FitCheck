import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, StatusBar, Modal, Animated, Dimensions, Animated as RNAnimated, PanGestureHandler, State, ScrollView } from 'react-native';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';

const AnimatedFlatList = RNAnimated.createAnimatedComponent(FlatList);
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import FitCard from '../components/FitCard';
import CommentModal from '../components/CommentModal';
import NotificationsScreen from './NotificationsScreen';
import { theme } from '../styles/theme';
import OptimizedImage from '../components/OptimizedImage';

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
    // Entrance animations
    Animated.parallel([
      Animated.timing(entranceFadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(entranceSlideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(titleScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    fetchUserGroups();
    fetchUserProfile();
    fetchUnreadNotificationsCount();
    
    // Initialize countdown
    setCountdownText(calculateTimeUntilMidnight());
    
    // Update countdown every minute
    const countdownInterval = setInterval(() => {
      setCountdownText(calculateTimeUntilMidnight());
    }, 60000); // Update every minute
    
    return () => clearInterval(countdownInterval);
  }, []);

  useEffect(() => {
    if (userGroups.length > 0) {
      fetchTodaysFits();
    }
  }, [userGroups, selectedGroup]);



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

        // Get user's read notifications from their profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const readNotificationIds = userData?.readNotificationIds || [];

        // Count unread notifications
        let unreadCount = 0;
        
        for (const fit of userFits) {
          if (fit.comments && Array.isArray(fit.comments)) {
            // Filter out comments by the user themselves and count unread ones
            const otherComments = fit.comments.filter(comment => 
              comment.userId !== user.uid
            );
            
            // Count comments that haven't been read
            const unreadComments = otherComments.filter(comment => {
              const notificationId = `${fit.id}_${comment.userId}_${comment.timestamp?.toDate?.()?.getTime() || comment.timestamp}`;
              return !readNotificationIds.includes(notificationId);
            });
            
            unreadCount += unreadComments.length;
          }
        }

        setUnreadNotificationsCount(unreadCount);
      });

      return unsubscribe;
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

  const fetchTodaysFits = async () => {
    if (userGroups.length === 0) return;

    try {
      // Get all group IDs the user belongs to
      const userGroupIds = userGroups.map(group => group.id);
      
      // Fetch fits that have any of the user's group IDs in their groupIds array
      const fitsQuery = query(
        collection(db, 'fits'),
        where('groupIds', 'array-contains-any', userGroupIds)
      );
      
      const unsubscribe = onSnapshot(fitsQuery, (snapshot) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let fitsData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(fit => {
            // Filter for today's fits on the client side
            const fitDate = fit.createdAt?.toDate();
            return fitDate && fitDate >= today;
          })
          .sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()); // Sort by newest first

        // Apply group filter if needed
        if (selectedGroup !== 'all') {
          fitsData = fitsData.filter(fit => 
            fit.groupIds && fit.groupIds.includes(selectedGroup)
          );
        }
        

        
        setFits(fitsData);
        calculateStats(fitsData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching fits:', error);
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
    setSelectedGroup(groupId);
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

    return (
      <TouchableOpacity
        key={key || group}
        style={[
          styles.groupButton,
          isSelected && styles.groupButtonSelected
        ]}
        onPress={() => handleGroupSelect(group)}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.groupButtonText,
          isSelected && styles.groupButtonTextSelected
        ]}>
          {isAllGroup ? 'All' : (typeof group === 'string' ? group : group.name)}
        </Text>
      </TouchableOpacity>
    );
  };

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
                  <Text style={styles.profilePlaceholderText}>👤</Text>
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
        ) : fits.length === 0 ? (
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
            data={fits}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <FitCard 
                fit={item} 
                onCommentSectionOpen={handleCommentSectionOpen}
                onOpenCommentModal={handleOpenCommentModal}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.feedContainer}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
          />
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
    paddingHorizontal: 20,
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
  groupButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  groupButtonTextSelected: {
    fontWeight: '600',
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
});