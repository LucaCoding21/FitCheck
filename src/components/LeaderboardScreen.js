import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
  Animated,
} from 'react-native';
import { collection, query, where, orderBy, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

// Helper function to calculate display rating with fallback
const calculateDisplayRating = (fit) => {
  // If fairRating exists and is not 0, use it
  if (fit.fairRating && fit.fairRating > 0) {
    return fit.fairRating.toFixed(1);
  }
  
  // Fallback: calculate from ratings object
  if (fit.ratings && Object.keys(fit.ratings).length > 0) {
    const ratings = Object.values(fit.ratings)
      .filter(r => r && typeof r.rating === 'number')
      .map(r => r.rating);
    
    if (ratings.length > 0) {
      const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      return Math.round(average * 10) / 10;
    }
  }
  
  return '0.0';
};

// Helper function to get leaderboard fits
export const getLeaderboardFits = async (groupId) => {
  try {
    // Get today's date at midnight (local timezone)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get tomorrow's date at midnight (local timezone)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Query fits for the specific group (simplified to avoid complex index)
    const fitsQuery = query(
      collection(db, 'fits'),
      where('groupIds', 'array-contains', groupId)
    );

    const snapshot = await getDocs(fitsQuery);
    const fits = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter for today's fits, 3+ ratings, and sort by fair rating
    const todayFits = fits.filter(fit => {
      const fitDate = fit.createdAt?.toDate();
      return fitDate && fitDate >= today && fitDate < tomorrow;
    });

    const eligibleFits = todayFits
      .filter(fit => (fit.ratingCount || 0) >= 3)
      .sort((a, b) => (b.fairRating || 0) - (a.fairRating || 0))
      .slice(0, 10); // Show top 10 instead of just 3

    return eligibleFits;
  } catch (error) {
    console.error('Error fetching leaderboard fits:', error);
    throw error;
  }
};

// Helper function to get all fits from user's groups
export const getAllGroupsLeaderboardFits = async (userGroups) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const allFits = [];
    
    for (const group of userGroups) {
      const fitsQuery = query(
        collection(db, 'fits'),
        where('groupIds', 'array-contains', group.id)
      );

      const snapshot = await getDocs(fitsQuery);
      const groupFits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      allFits.push(...groupFits);
    }

    // Filter for today's fits, 3+ ratings, and sort by fair rating
    const todayFits = allFits.filter(fit => {
      const fitDate = fit.createdAt?.toDate();
      return fitDate && fitDate >= today && fitDate < tomorrow;
    });

    const eligibleFits = todayFits
      .filter(fit => (fit.ratingCount || 0) >= 3)
      .sort((a, b) => (b.fairRating || 0) - (a.fairRating || 0))
      .slice(0, 10);

    return eligibleFits;
  } catch (error) {
    console.error('Error fetching all groups leaderboard fits:', error);
    throw error;
  }
};

export default function LeaderboardScreen({ navigation, route }) {
  const { user } = useAuth();
  const [leaderboardFits, setLeaderboardFits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('all'); // 'all' or groupId
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [countdownText, setCountdownText] = useState('');

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

  // Use groupId from route params if available (for direct navigation), otherwise use selected group
  const groupId = route?.params?.groupId || (selectedGroup === 'all' ? null : selectedGroup);

  useEffect(() => {
    fetchUserGroups();
    animateIn();
    
    // Initialize countdown
    setCountdownText(calculateTimeUntilMidnight());
    
    // Update countdown every minute
    const countdownInterval = setInterval(() => {
      setCountdownText(calculateTimeUntilMidnight());
    }, 60000); // Update every minute
    
    return () => clearInterval(countdownInterval);
  }, []);

  useEffect(() => {
    if (userGroups.length > 0 && selectedGroup === 'all') {
      fetchAllGroupsLeaderboard();
    } else if (selectedGroup !== 'all') {
      fetchLeaderboard();
    }
  }, [selectedGroup, userGroups]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
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

  const fetchLeaderboard = async () => {
    if (!selectedGroup || selectedGroup === 'all') return;

    setLoading(true);
    try {
      const fits = await getLeaderboardFits(selectedGroup);
      setLeaderboardFits(fits);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllGroupsLeaderboard = async () => {
    if (userGroups.length === 0) return;

    setLoading(true);
    try {
      const fits = await getAllGroupsLeaderboardFits(userGroups);
      setLeaderboardFits(fits);
    } catch (error) {
      console.error('Error fetching all groups leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadgeStyle = (position) => {
    switch (position) {
      case 1:
        return { backgroundColor: '#CD9F3E', borderColor: '#CD9F3E' }; // Gold
      case 2:
        return { backgroundColor: '#A9A9A9', borderColor: '#A9A9A9' }; // Silver
      case 3:
        return { backgroundColor: '#7F461F', borderColor: '#7F461F' }; // Bronze
      default:
        return { backgroundColor: 'transparent', borderColor: 'transparent' };
    }
  };

  const renderLeaderboardItem = ({ item, index }) => {
    const position = index + 1;
    const isTopThree = position <= 3;
    const rankBadgeStyle = getRankBadgeStyle(position);
    const isCurrentUser = item.userId === user?.uid;
    
    return (
      <TouchableOpacity
        onPress={() => {
          // Navigate to fit details
          navigation.navigate('FitDetails', { 
            fitId: item.id 
          });
        }}
        activeOpacity={0.7}
      >
        <Animated.View
          style={[
            styles.leaderboardItem,
            isCurrentUser && styles.currentUserItem,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Rank Badge */}
          <View style={[styles.rankBadge, rankBadgeStyle]}>
            <Text style={[styles.rankText, isTopThree && styles.topThreeRankText]}>
              {position}
            </Text>
          </View>

          {/* Profile Picture */}
          <View style={styles.profileContainer}>
            {item.userProfileImageURL ? (
              <Image
                source={{ uri: item.userProfileImageURL }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholderProfile}>
                <Text style={styles.placeholderText}>👤</Text>
              </View>
            )}
          </View>

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.username}>{item.userName || 'Anonymous'}</Text>
            {isCurrentUser && (
              <Text style={styles.currentUserLabel}>You</Text>
            )}
          </View>

          {/* Rating */}
          <View style={styles.ratingContainer}>
            <Text style={styles.starIcon}>★</Text>
            <Text style={styles.ratingText}>
              {calculateDisplayRating(item)} 
              <Text style={styles.ratingCount}>
                ({item.ratingCount || 0})
              </Text>
            </Text>
          </View>

          {/* Navigation Arrow */}
          <View style={styles.arrowContainer}>
            <Text style={styles.arrowIcon}>›</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <Animated.View
      style={[
        styles.emptyState,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.emptyIcon}>
        <Image 
          source={require('../../assets/starman-whitelegs.png')} 
          style={styles.emptyIconImage}
        />
      </View>
      <Text style={styles.emptyTitle}>Ready to Compete?</Text>
      <Text style={styles.emptyText}>
        Post your fit and get 3+ ratings to climb the leaderboard
      </Text>
      <Text style={styles.emptySubtext}>
        The competition heats up when everyone participates
      </Text>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.title}>Daily Leaderboard</Text>
        <Text style={styles.subtitle}>
          Feed resets in <Text style={styles.countdownTime}>{countdownText}</Text>
        </Text>
      </Animated.View>

      {/* Group Filter */}
      {userGroups.length > 0 && (
        <Animated.View
          style={[
            styles.groupFilterContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.groupFilterTabs}>
            <TouchableOpacity 
              style={[
                styles.groupFilterTab, 
                selectedGroup === 'all' && styles.groupFilterTabActive
              ]}
              onPress={() => setSelectedGroup('all')}
            >
              <Text style={[
                styles.groupFilterText,
                selectedGroup === 'all' && styles.groupFilterTextActive
              ]}>
                All
              </Text>
            </TouchableOpacity>
            {userGroups.map((group) => (
              <TouchableOpacity 
                key={group.id}
                style={[
                  styles.groupFilterTab, 
                  selectedGroup === group.id && styles.groupFilterTabActive
                ]}
                onPress={() => setSelectedGroup(group.id)}
              >
                <Text style={[
                  styles.groupFilterText,
                  selectedGroup === group.id && styles.groupFilterTextActive
                ]}>
                  {group.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {userGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>👥</Text>
            </View>
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptyText}>
              Join a group to see the daily leaderboard
            </Text>
            <TouchableOpacity 
              style={styles.joinGroupButton}
              onPress={() => navigation.navigate('Groups')}
            >
              <Text style={styles.joinGroupButtonText}>Join a Group</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading leaderboard...</Text>
          </View>
        ) : leaderboardFits.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={leaderboardFits}
            keyExtractor={(item) => item.id}
            renderItem={renderLeaderboardItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  countdownTime: {
    color: '#CD9F3E',
  },

  groupFilterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  groupFilterTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupFilterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  groupFilterTabActive: {
    backgroundColor: '#B5483D',
    borderColor: '#B5483D',
  },
  groupFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  groupFilterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#CCCCCC',
  },
  listContainer: {
    paddingBottom: 100,
  },
  leaderboardItem: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 13,
    alignItems: 'center',
  },
  currentUserItem: {
    borderWidth: 2,
    borderColor: 'rgba(181, 72, 61, 0.6)',
    backgroundColor: '#2a2a2a',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  topThreeRankText: {
    color: '#FFFFFF',
  },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 10,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  placeholderProfile: {
    width: '100%',
    height: '100%',
    backgroundColor: '#444444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 20,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  currentUserLabel: {
    fontSize: 12,
    color: 'rgba(181, 72, 61, 0.8)',
    fontWeight: '600',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  starIcon: {
    fontSize: 18,
    color: '#FFD700',
    marginRight: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '400',
  },
  arrowContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 18,
    color: '#666666',
    fontWeight: 'bold',
  },
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
    marginBottom:60,
    marginTop: 10,
  },
  emptyIconText: {
    fontSize: 40,
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
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
  joinGroupButton: {
    backgroundColor: '#B5483D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  joinGroupButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
}); 