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
  showGroupName = false 
}) {
  if (!winner || !winner.winner) {
    return null;
  }

  const { winner: winnerData, date, groupName } = winner;
  
  // Format date for display (like polaroid captions)
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

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isCurrentUser && styles.currentUserContainer
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Polaroid-style Image Container */}
      <View style={styles.polaroidContainer}>
        <OptimizedImage
          source={{ uri: winnerData.imageURL }}
          style={styles.image}
          contentFit="cover"
          showLoadingIndicator={true}
          priority="normal"
        />
        
        {/* Subtle Winner Indicator */}
        <View style={styles.winnerIndicator}>
          <Ionicons name="trophy" size={12} color="#FFD700" />
        </View>
      </View>

      {/* Polaroid-style Caption Area */}
      <View style={styles.captionArea}>
        <Text style={styles.userName} numberOfLines={1}>
          {winnerData.userName || 'Unknown'}
        </Text>
        <Text style={styles.dateText}>{formattedDate}</Text>
        {showGroupName && groupName && (
          <Text style={styles.groupName} numberOfLines={1}>{groupName}</Text>
        )}
        {winnerData.caption && (
          <Text style={styles.captionText} numberOfLines={2}>
            "{winnerData.caption}"
          </Text>
        )}
        {winnerData.tag && (
          <Text style={styles.tagText}>#{winnerData.tag}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 16,
    width: (width - 48) / 2, // Two columns with spacing
    ...theme.shadows.md,
  },
  currentUserContainer: {
    borderWidth: 2,
    borderColor: theme.colors.secondary,
  },
  polaroidContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1, // Square like polaroids
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  winnerIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionArea: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 4,
  },
  captionText: {
    fontSize: 12,
    color: '#333333',
    fontStyle: 'italic',
    lineHeight: 16,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '500',
  },
}); 