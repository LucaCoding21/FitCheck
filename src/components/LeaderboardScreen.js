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

// Helper function to get leaderboard fits
export const getLeaderboardFits = async (groupId) => {
  try {
    // Get today's date at midnight (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // Get tomorrow's date at midnight (UTC)
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

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
      .slice(0, 3);

    return eligibleFits;
  } catch (error) {
    console.error('Error fetching leaderboard fits:', error);
    throw error;
  }
};

export default function LeaderboardScreen({ navigation, route }) {
  const { user } = useAuth();
  const [leaderboardFits, setLeaderboardFits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  // Use groupId from route params if available (for direct navigation), otherwise use selected group
  const groupId = route?.params?.groupId || selectedGroup;

  useEffect(() => {
    fetchUserGroups();
    animateIn();
  }, []);

  useEffect(() => {
    if (userGroups.length > 0 && !selectedGroup) {
      setSelectedGroup(userGroups[0].id);
    }
  }, [userGroups]);

  useEffect(() => {
    if (groupId) {
      fetchLeaderboard();
    }
  }, [groupId]);

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
    if (!groupId) return;

    setLoading(true);
    try {
      const fits = await getLeaderboardFits(groupId);
      setLeaderboardFits(fits);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderLeaderboardItem = ({ item, index }) => {
    const position = index + 1;
    const isTopThree = position <= 3;
    
    return (
      <Animated.View
        style={[
          styles.leaderboardItem,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Position Badge */}
        <View style={[styles.positionBadge, isTopThree && styles.topThreeBadge]}>
          <Text style={[styles.positionText, isTopThree && styles.topThreeText]}>
            {position}
          </Text>
        </View>

        {/* Fit Image */}
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.fitImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>📸</Text>
            </View>
          )}
        </View>

        {/* Fit Details */}
        <View style={styles.fitDetails}>
          <Text style={styles.username}>{item.userName || 'Anonymous'}</Text>
          <Text style={styles.caption} numberOfLines={2}>
            {item.caption || 'No caption'}
          </Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>
              {item.fairRating ? item.fairRating.toFixed(1) : '0.0'}
            </Text>
            <Text style={styles.ratingLabel}>★</Text>
            <Text style={styles.ratingCount}>
              ({item.ratingCount || 0} ratings)
            </Text>
          </View>
        </View>
      </Animated.View>
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
        <Text style={styles.emptyIconText}>🏆</Text>
      </View>
      <Text style={styles.emptyTitle}>No Leaderboard Yet</Text>
      <Text style={styles.emptyText}>
        Fits need at least 3 ratings to appear on the leaderboard
      </Text>
      <Text style={styles.emptySubtext}>
        Encourage your group to rate today's fits!
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
        <View style={styles.headerContent}>
          <Text style={styles.title}>Daily Leaderboard</Text>
          {userGroups.length > 0 && (
            <View style={styles.groupSelector}>
              <Text style={styles.groupLabel}>Group:</Text>
              <TouchableOpacity
                style={styles.groupButton}
                onPress={() => {
                  // Cycle through groups
                  const currentIndex = userGroups.findIndex(g => g.id === selectedGroup);
                  const nextIndex = (currentIndex + 1) % userGroups.length;
                  setSelectedGroup(userGroups[nextIndex].id);
                }}
              >
                <Text style={styles.groupName}>
                  {userGroups.find(g => g.id === selectedGroup)?.name || 'Select Group'}
                </Text>
                <Text style={styles.groupArrow}>▼</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>

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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  groupSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupLabel: {
    fontSize: 16,
    color: '#CCCCCC',
    marginRight: 8,
  },
  groupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  groupName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginRight: 4,
  },
  groupArrow: {
    fontSize: 12,
    color: '#CCCCCC',
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
    paddingBottom: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  positionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#666666',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  topThreeBadge: {
    backgroundColor: '#B5483D',
  },
  positionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  topThreeText: {
    color: '#FFFFFF',
  },
  imageContainer: {
    width: 60,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 16,
  },
  fitImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#444444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 24,
  },
  fitDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 8,
    lineHeight: 20,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B5483D',
    marginRight: 4,
  },
  ratingLabel: {
    fontSize: 16,
    color: '#B5483D',
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: '#999999',
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
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIconText: {
    fontSize: 40,
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