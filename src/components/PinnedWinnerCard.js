import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import OptimizedImage from './OptimizedImage';
import { formatRating } from '../utils/ratingUtils';
import { getYesterdayWinner } from '../services/DailyWinnerService';



const PinnedWinnerCard = ({ onPress, navigation, selectedGroup }) => {
  const { user } = useAuth();
  const [yesterdayWinner, setYesterdayWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  // Simple fetch function
  const fetchYesterdayWinner = async () => {
    try {
      if (!user?.uid || !selectedGroup) {
        setLoading(false);
        return;
      }
      setLoading(true);
      
      const winnerData = await getYesterdayWinner(user.uid, selectedGroup);
      if (isMountedRef.current && winnerData && winnerData.winner) {
        setYesterdayWinner(winnerData.winner);
      } else {
        setYesterdayWinner(null);
      }
    } catch (error) {
      console.error('🏆 PinnedWinnerCard: Error fetching winner:', error);
      setYesterdayWinner(null);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchYesterdayWinner();
    return () => { isMountedRef.current = false; };
  }, [user?.uid, selectedGroup]);

  const handlePress = () => {
    if (navigation && yesterdayWinner?.fitId) {
      // Navigate to HallOfFlame with the specific winner's fitId for celebration
      navigation.navigate('HallOfFlame', { 
        selectedGroup,
        winnerFitId: yesterdayWinner.fitId,
        celebrationMode: true
      });
    }
    if (onPress) onPress();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.winnerBanner}>
            {/* User Info Section - Same layout as winner card */}
            <View style={styles.userSection}>
              <View style={styles.loadingIconContainer}>
                <Ionicons name="trophy" size={20} color="#FFD700" />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.username}>Loading...</Text>
                <Text style={styles.groupName}>Fetching yesterday's winner</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (!yesterdayWinner) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.winnerBanner}>
            {/* User Info Section - Same layout as winner card */}
            <View style={styles.userSection}>
              <View style={styles.noWinnerIconContainer}>
                <Ionicons name="trophy-outline" size={20} color="#71717A" />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.username}>No Winner Yesterday</Text>
                <Text style={styles.groupName}>No fits were posted or rated</Text>
              </View>
            </View>

          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Winner Banner Design */}
        <View style={styles.winnerBanner}>
          {/* User Info Section - Same layout as FitCard */}
          <View style={styles.userSection}>
            <View style={styles.profileImageContainer}>
              {yesterdayWinner.userProfileImageURL ? (
                <OptimizedImage
                  source={{ uri: yesterdayWinner.userProfileImageURL }}
                  style={styles.profileImage}
                  showLoadingIndicator={false}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={20} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.username} numberOfLines={1}>
                {yesterdayWinner.userName || 'Unknown User'}
              </Text>
              <Text style={styles.groupName} numberOfLines={1}>
                {selectedGroup === 'all' ? 'All Groups' : selectedGroup}
              </Text>
            </View>
          </View>
          {/* Winner Badge Section */}
          <View style={styles.winnerBadgeSection}>
            <View style={styles.winnerBadge}>
              <Ionicons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.winnerLabel}>Yesterday</Text>
            </View>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>
                {formatRating(yesterdayWinner.averageRating)}
              </Text>
              <Text style={styles.ratingCount}>
                ({yesterdayWinner.ratingCount})
              </Text>
            </View>
          </View>
          {/* Chevron */}
          <View style={styles.chevronSection}>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

PinnedWinnerCard.displayName = 'PinnedWinnerCard';
export default PinnedWinnerCard;

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
    aspectRatio: 3/4,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  groupName: {
    fontSize: 13,
    color: '#747474',
  },
  winnerBadgeSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  winnerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  ratingCount: {
    fontSize: 13,
    fontWeight: '400',
    color: '#71717A',
  },
  chevronSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  noWinnerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  loadingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

}); 