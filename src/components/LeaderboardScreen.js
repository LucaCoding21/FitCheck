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
  ScrollView,
  Modal,
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

// Helper function to calculate dynamic rating threshold based on group size
const getRatingThreshold = (groupSize) => {
  // For small groups (1-3 members): require 1 rating
  if (groupSize <= 3) return 1;
  
  // For medium groups (4-6 members): require 2 ratings
  if (groupSize <= 6) return 2;
  
  // For larger groups (7-10 members): require 3 ratings
  if (groupSize <= 10) return 3;
  
  // For very large groups (11+ members): require 4 ratings (maximum)
  return 4;
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

    // Get group size to calculate dynamic threshold
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    const groupSize = groupDoc.exists() ? (groupDoc.data().memberCount || 1) : 1;
    const ratingThreshold = getRatingThreshold(groupSize);

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

    // Filter for today's fits with dynamic rating threshold, and sort by fair rating
    const todayFits = fits.filter(fit => {
      const fitDate = fit.createdAt?.toDate();
      return fitDate && fitDate >= today && fitDate < tomorrow;
    });

    const eligibleFits = todayFits
      .filter(fit => (fit.ratingCount || 0) >= ratingThreshold)
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

    // Use a Map to ensure unique fits by ID
    const uniqueFitsMap = new Map();
    
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

      // Add fits to map, using fit ID as key to prevent duplicates
      groupFits.forEach(fit => {
        if (!uniqueFitsMap.has(fit.id)) {
          uniqueFitsMap.set(fit.id, fit);
        }
      });
    }

    // Convert map values back to array
    const allFits = Array.from(uniqueFitsMap.values());

    // Filter for today's fits with dynamic rating thresholds per group
    const todayFits = allFits.filter(fit => {
      const fitDate = fit.createdAt?.toDate();
      return fitDate && fitDate >= today && fitDate < tomorrow;
    });

    // Apply dynamic threshold filtering based on each fit's group
    const eligibleFits = [];
    for (const fit of todayFits) {
      // Find the group this fit belongs to
      const fitGroup = userGroups.find(group => 
        fit.groupIds && fit.groupIds.includes(group.id)
      );
      
      if (fitGroup) {
        const groupSize = fitGroup.memberCount || 1;
        const ratingThreshold = getRatingThreshold(groupSize);
        
        if ((fit.ratingCount || 0) >= ratingThreshold) {
          // Add group context to the fit for fair comparison
          eligibleFits.push({
            ...fit,
            _groupSize: groupSize,
            _ratingThreshold: ratingThreshold,
            _groupName: fitGroup.name
          });
        }
      }
    }

    // Sort by adjusted rating (normalized for group size) and return top 10
    const sortedFits = eligibleFits
      .map(fit => {
        // Calculate adjusted rating to normalize for group size differences
        const baseRating = fit.fairRating || 0;
        const ratingCount = fit.ratingCount || 0;
        const groupSize = fit._groupSize;
        
        // Bonus for higher rating counts relative to group size
        const ratingRatio = ratingCount / groupSize;
        const ratingBonus = Math.min(ratingRatio * 0.5, 0.5); // Max 0.5 bonus
        
        // Penalty for very small groups to prevent gaming
        const smallGroupPenalty = groupSize <= 3 ? 0.3 : 0;
        
        const adjustedRating = baseRating + ratingBonus - smallGroupPenalty;
        
        // Cap the adjusted rating at 5.0 stars maximum
        const cappedAdjustedRating = Math.min(adjustedRating, 5.0);
        
        return {
          ...fit,
          _adjustedRating: cappedAdjustedRating
        };
      })
      .sort((a, b) => b._adjustedRating - a._adjustedRating)
      .slice(0, 10);

    return sortedFits;

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
  const [showInfoModal, setShowInfoModal] = useState(false);

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

  const renderEmptyState = () => {
    // Calculate the required ratings based on selected group
    let requiredRatings = 3; // Default fallback
    let groupName = "your group";
    
    if (selectedGroup === 'all') {
      // For "all groups" view, show a sophisticated message about fair comparison
      requiredRatings = 1;
      groupName = "any group";
    } else {
      // For specific group, get the actual threshold
      const selectedGroupData = userGroups.find(group => group.id === selectedGroup);
      if (selectedGroupData) {
        const groupSize = selectedGroupData.memberCount || 1;
        requiredRatings = getRatingThreshold(groupSize);
        groupName = selectedGroupData.name;
      }
    }

    // Create dynamic message based on required ratings
    const getRatingMessage = (ratings) => {
      if (ratings === 1) {
        return "Post your fit and get 1 rating to climb the leaderboard";
      } else if (ratings === 2) {
        return "Post your fit and get 2+ ratings to climb the leaderboard";
      } else if (ratings === 3) {
        return "Post your fit and get 3+ ratings to climb the leaderboard";
      } else {
        return `Post your fit and get ${ratings}+ ratings to climb the leaderboard`;
      }
    };

    const getSubtext = (ratings, groupName) => {
      if (selectedGroup === 'all') {
        return "Fits are ranked fairly across all your groups, with adjustments for group size and rating participation";
      } else if (ratings === 1) {
        return `Perfect for small groups like ${groupName} - just one rating gets you on the board!`;
      } else if (ratings === 2) {
        return `Medium-sized groups like ${groupName} need a bit more validation`;
      } else if (ratings === 3) {
        return `Larger groups like ${groupName} require more ratings for fair competition`;
      } else {
        return `Big groups like ${groupName} need ${ratings} ratings to ensure quality`;
      }
    };

    return (
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
          {getRatingMessage(requiredRatings)}
        </Text>
        <Text style={styles.emptySubtext}>
          {getSubtext(requiredRatings, groupName)}
        </Text>
      </Animated.View>
    );
  };

  const renderGroupButton = (group, isSelected, key) => {
    const isAllGroup = group === 'all';
    
    return (
      <TouchableOpacity
        key={key || group}
        style={[
          styles.groupButton,
          isSelected && styles.groupButtonSelected
        ]}
        onPress={() => setSelectedGroup(isAllGroup ? 'all' : group.id)}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.groupButtonText,
          isSelected && styles.groupButtonTextSelected
        ]}>
          {isAllGroup ? 'All' : group.name}
        </Text>
      </TouchableOpacity>
    );
  };

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
        <View style={styles.headerTop}>
          <Text style={styles.title}>Daily Leaderboard</Text>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => setShowInfoModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.infoButtonText}>?</Text>
          </TouchableOpacity>
        </View>
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
          </ScrollView>
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

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How Rankings Work</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowInfoModal(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreTitle}>How You Rank</Text>
                <Text style={styles.scoreText}>Your average stars + bonus for active groups</Text>
                <Text style={styles.scoreNote}>Max 5.0 stars possible</Text>
              </View>

              <View style={styles.ruleCard}>
                <Text style={styles.ruleTitle}>Rating Requirements</Text>
                <Text style={styles.ruleText}>Small groups (1-3): 1 rating</Text>
                <Text style={styles.ruleText}>Medium groups (4-6): 2 ratings</Text>
                <Text style={styles.ruleText}>Large groups (7+): 3-4 ratings</Text>
              </View>

              <Text style={styles.modalSubtext}>
                Fair for all group sizes, resets daily
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  groupsTitle: {
    fontSize: 16,
    color: '#6C6C6C',
    marginBottom: 12,
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
  // Header info button styles
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444444',
  },
  infoButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    marginHorizontal: 24,
    maxWidth: 420,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444444',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#444444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 24,
  },
  scoreCard: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  scoreText: {
    fontSize: 15,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  scoreNote: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  ruleCard: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  ruleText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 8,
    lineHeight: 18,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  learnMoreButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#B5483D',
    borderRadius: 8,
  },
  learnMoreText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
}); 