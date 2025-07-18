import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  StatusBar,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

// Helper function to get user's fits
export const getMyFits = async (userId) => {
  try {
    // Query fits for the specific user (simplified to avoid complex index)
    const fitsQuery = query(
      collection(db, 'fits'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(fitsQuery);
    const fits = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by most recent first (client-side sorting)
    const sortedFits = fits.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA; // Descending order (newest first)
    });

    return sortedFits;
  } catch (error) {
    console.error('Error fetching user fits:', error);
    throw error;
  }
};

// Helper function to format date
const formatDate = (date) => {
  if (!date) return 'Unknown date';
  
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now - dateObj);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return 'Today';
  } else if (diffDays === 2) {
    return 'Yesterday';
  } else if (diffDays <= 7) {
    return `${diffDays - 1} days ago`;
  } else {
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
};

// Helper function to format rating
const formatRating = (fit) => {
  if (!fit.ratingCount || fit.ratingCount < 1) {
    return 'Not yet rated';
  }
  
  const rating = fit.fairRating || 0;
  return `${rating.toFixed(1)} ★ (${fit.ratingCount} ratings)`;
};

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [myFits, setMyFits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    if (user?.uid) {
      fetchMyFits();
      animateIn();
    }
  }, [user]);

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

  const fetchMyFits = async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const fits = await getMyFits(user.uid);
      setMyFits(fits);
    } catch (error) {
      console.error('Error fetching my fits:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderFitItem = ({ item, index }) => {
    return (
      <Animated.View
        style={[
          styles.fitItem,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
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
          <View style={styles.fitHeader}>
            <Text style={styles.caption} numberOfLines={1}>
              {item.caption || 'No caption'}
            </Text>
            <Text style={styles.tag}>
              #{item.tag || 'no-tag'}
            </Text>
          </View>
          
          <View style={styles.fitFooter}>
            <Text style={styles.date}>
              {formatDate(item.createdAt)}
            </Text>
            <Text style={styles.rating}>
              {formatRating(item)}
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
        <Text style={styles.emptyIconText}>👕</Text>
      </View>
      <Text style={styles.emptyTitle}>No Fits Yet</Text>
      <Text style={styles.emptyText}>
        Start sharing your style with your group!
      </Text>
      <TouchableOpacity 
        style={styles.postFitButton}
        onPress={() => navigation.navigate('PostFit')}
      >
        <Text style={styles.postFitButtonText}>Post Your First Fit</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your fits...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>My Fits</Text>
        <Text style={styles.headerSubtitle}>
          {myFits.length} fit{myFits.length !== 1 ? 's' : ''} posted
        </Text>
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
        {myFits.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={myFits}
            keyExtractor={(item) => item.id}
            renderItem={renderFitItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            numColumns={2}
            columnWrapperStyle={styles.row}
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
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
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
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    fontSize: 16,
    color: '#CCCCCC',
  },
  listContainer: {
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
  },
  fitItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 16,
    width: '48%',
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 150,
    backgroundColor: '#444444',
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
    fontSize: 32,
  },
  fitDetails: {
    padding: 12,
  },
  fitHeader: {
    marginBottom: 8,
  },
  caption: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tag: {
    fontSize: 12,
    color: '#B5483D',
    fontWeight: '500',
  },
  fitFooter: {
    justifyContent: 'space-between',
  },
  date: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 4,
  },
  rating: {
    fontSize: 12,
    color: '#CCCCCC',
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
    marginBottom: 20,
    lineHeight: 24,
  },
  postFitButton: {
    backgroundColor: '#B5483D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  postFitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
}); 