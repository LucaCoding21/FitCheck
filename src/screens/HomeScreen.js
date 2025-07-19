import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, StatusBar, Modal, Animated, Dimensions, Image, Animated as RNAnimated, PanGestureHandler, State } from 'react-native';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';

const AnimatedFlatList = RNAnimated.createAnimatedComponent(FlatList);
import { signOut } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import FitCard from '../components/FitCard';
import CommentModal from '../components/CommentModal';
import NotificationsScreen from './NotificationsScreen';
import { theme } from '../styles/theme';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation, route }) {
  const { user } = useAuth();
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
              await signOut(auth);
              navigation.replace('Onboarding');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
  };

  const handleAddGroup = () => {
    navigation.navigate('Groups');
  };

  const handleNotificationPress = () => {
    setShowNotifications(true);
  };

  const handleCloseNotifications = () => {
    setShowNotifications(false);
  };

  const handleNavigateToFit = (fitId) => {
    // Find the fit in the current list and scroll to it
    const fitIndex = fits.findIndex(fit => fit.id === fitId);
    if (fitIndex !== -1 && flatListRef.current) {
      // Delay scroll to allow notifications to close
      setTimeout(() => {
        flatListRef.current.scrollToIndex({
          index: fitIndex,
          animated: true,
          viewPosition: 0.1, // Position the item 15% from the top (higher up)
          viewOffset: 0, // Additional offset to move it up more
        });
      }, 350); // Wait for notifications to close
    }
  };

  const handleScroll = (event) => {
    // Simple scroll handler - no header animation
    // Just for logging or future use
  };

  const handleCommentSectionOpen = (fitId) => {
    // Find the index of the fit in the array
    const fitIndex = fits.findIndex(fit => fit.id === fitId);
    if (fitIndex !== -1 && flatListRef.current) {
      // Delay scroll to allow comment section animation to complete
      setTimeout(() => {
        flatListRef.current.scrollToIndex({
          index: fitIndex,
          animated: true,
          viewPosition: 0.8, // Position the item 80% from the top (scrolls down)
          viewOffset: -300, // Reduced offset since we're scrolling down
        });
      }, 300); // Wait 300ms for comment section to open
    }
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

  const renderGroupButton = (group, isSelected) => {
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
        key={group}
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
          {isAllGroup ? 'All' : group}
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
              <Image 
                source={require('../../assets/noti.png')} 
                style={styles.notificationIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              {userProfileImageURL ? (
                <Image 
                  source={{ uri: userProfileImageURL }} 
                  style={styles.profileImage}
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
          <Text style={styles.groupsTitle}>Your Groups</Text>
          <View style={styles.groupsContainer}>
            {renderGroupButton('all', selectedGroup === 'all')}
            {userGroups.slice(0, 2).map(group => 
              renderGroupButton(group.name, selectedGroup === group.id)
            )}
            {renderGroupButton('add')}
          </View>
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
              <Text style={styles.emptyIconText}>📸</Text>
            </View>
            <Text style={styles.emptyText}>No fits posted today</Text>
            <Text style={styles.emptySubtext}>
              Be the first to drop your fit in any of your groups
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
            ListHeaderComponent={
              <Text style={styles.todaysFitsTitle}>Today's Fits</Text>
            }
          />
        )}
      </Animated.View>

      {/* Notifications Screen */}
      <NotificationsScreen
        isVisible={showNotifications}
        onClose={handleCloseNotifications}
        onNavigateToFit={handleNavigateToFit}
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
    backgroundColor: '#121212',
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
    marginBottom: 20,
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
    marginBottom: 20,
  },
  groupsTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
    opacity: 0.8,
  },
  groupsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#B5483D',
    borderColor: '#B5483D',
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
    paddingHorizontal: 20,
  },
  todaysFitsTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  feedContainer: {
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
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
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