import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import { theme } from '../styles/theme';

const { width } = Dimensions.get('window');

export default function WinnerArchiveCard({ 
  winner, 
  onPress, 
  isCurrentUser = false,
  showGroupName = false,
  isFirstInRow = false,
  isLastInRow = false
}) {
  if (!winner || !winner.winner) {
    return null;
  }

  const { winner: winnerData, date, groupName: topLevelGroupName } = winner;
  
  // Format date for display with timeline feel
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateString === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formattedDate = formatDate(date);
  const rating = winnerData.averageRating || 0;
  const ratingCount = winnerData.ratingCount || 0;

  // Determine fire intensity based on rating
  const getFireIntensity = (rating) => {
    if (rating >= 4.8) return 'high';
    if (rating >= 4.5) return 'medium';
    return 'low';
  };

  const fireIntensity = getFireIntensity(rating);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isCurrentUser && styles.currentUserContainer,
        isFirstInRow && styles.firstInRow,
        isLastInRow && styles.lastInRow
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Fire-themed Image Container */}
      <View style={styles.imageContainer}>
        <OptimizedImage
          source={{ uri: winnerData.imageURL }}
          style={styles.image}
          contentFit="cover"
          showLoadingIndicator={true}
          priority="normal"
        />
        
        {/* Fire Glow Overlay */}
        <View style={[styles.fireGlow, styles[`fireGlow${fireIntensity}`]]} />

        {/* Rating Badge */}
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#FFD700" />
          <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
        </View>

        {/* Tag Overlay */}
        {winnerData.tag && (
          <View style={styles.tagOverlay}>
            <Text style={styles.tagText}>#{winnerData.tag}</Text>
          </View>
        )}
      </View>

      {/* Enhanced Info Section */}
      <View style={styles.infoSection}>
        {/* User Info Row */}
        <View style={styles.userRow}>
          <View style={styles.profileContainer}>
            {winnerData.userProfileImageURL ? (
              <OptimizedImage
                source={{ uri: winnerData.userProfileImageURL }}
                style={styles.profileImage}
                showLoadingIndicator={false}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {winnerData.userName || 'Unknown'}
            </Text>
            {showGroupName && (winnerData.groupName || topLevelGroupName) && (
              <Text style={styles.groupName} numberOfLines={1}>
                {winnerData.groupName || topLevelGroupName}
              </Text>
            )}
          </View>
        </View>

        {/* Timeline Date */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineDot} />
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="star" size={12} color={theme.colors.secondary} />
            <Text style={styles.statText}>{rating.toFixed(1)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="people" size={12} color={theme.colors.textSecondary} />
            <Text style={styles.statText}>{ratingCount}</Text>
          </View>
        </View>

        {/* Caption Preview */}
        {winnerData.caption && (
          <Text style={styles.captionText} numberOfLines={2}>
            "{winnerData.caption}"
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginBottom: 20,
    width: (width - 48) / 2,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  currentUserContainer: {
    borderWidth: 2,
    borderColor: theme.colors.secondary,
  },
  firstInRow: {
    marginLeft: 16,
    marginRight: 8,
  },
  lastInRow: {
    marginLeft: 8,
    marginRight: 16,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 3/4,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fireGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  fireGlowhigh: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  fireGlowmedium: {
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
  },
  fireGlowlow: {
    backgroundColor: 'rgba(255, 193, 7, 0.05)',
  },
  ratingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tagOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoSection: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 10,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 2,
  },
  groupName: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  timelineSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.secondary,
    marginRight: 8,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: theme.colors.border,
    marginHorizontal: 8,
  },
  captionText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
}); 