import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  Animated,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';
import OptimizedImage from '../components/OptimizedImage';

// Helper function to get user's fits
export const getMyFits = async (userId) => {
  try {
    const fitsQuery = query(
      collection(db, 'fits'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(fitsQuery);
    const fits = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by most recent first
    const sortedFits = fits.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA;
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
    return null;
  }
  
  let rating = fit.fairRating || 0;
  
  if (rating === 0 && fit.ratings && Object.keys(fit.ratings).length > 0) {
    const ratings = Object.values(fit.ratings)
      .filter(r => r && typeof r.rating === 'number')
      .map(r => r.rating);
    
    if (ratings.length > 0) {
      rating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      rating = Math.round(rating * 10) / 10;
    }
  }
  
  return rating;
};

export default function ProfileScreen({ navigation }) {
  const { user, signOutUser } = useAuth();
  const [myFits, setMyFits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
      const unsubscribe = setupRealTimeListener();
      unsubscribeRef.current = unsubscribe;
      animateIn();
      
      // Cleanup function to unsubscribe when component unmounts or user changes
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    } else {
      // Reset state when user is not available
      setMyFits([]);
      setUserData(null);
      setLoading(false);
    }
  }, [user]);

  // Add focus listener to ensure data is fresh when navigating back to profile
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      // The real-time listener should already be active, but this ensures fresh data
      if (user?.uid && !loading) {
        // Trigger a brief refresh to ensure we have the latest data
        setRefreshing(true);
        setTimeout(() => {
          setRefreshing(false);
        }, 500);
      }
    });

    return unsubscribeFocus;
  }, [navigation, user, loading]);

  const fetchUserData = async () => {
    if (!user?.uid) {
      console.log('User not available, skipping user data fetch');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const setupRealTimeListener = () => {
    if (!user?.uid) {
      console.log('User not available, skipping real-time listener setup');
      return null;
    }

    setLoading(true);
    
    // Create real-time query for user's fits
    const fitsQuery = query(
      collection(db, 'fits'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(fitsQuery, (snapshot) => {
      const fits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setMyFits(fits);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to fits:', error);
      setLoading(false);
    });

    // Return the unsubscribe function
    return unsubscribe;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // The real-time listener will automatically update the data
    // We just need to show the refresh indicator briefly
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
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
              // Clean up real-time listeners before signing out
              if (unsubscribeRef.current) {
                unsubscribeRef.current();
              }
              
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

  const renderFitItem = ({ item, index }) => {
    const rating = formatRating(item);
    
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('FitDetails', { fitId: item.id })}
        activeOpacity={0.9}
        style={styles.fitItemContainer}
      >
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
            {item.imageURL ? (
              <OptimizedImage
                source={{ uri: item.imageURL }}
                style={styles.fitImage}
                contentFit="cover"
                priority="normal"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="camera-outline" size={32} color="#666" />
              </View>
            )}
            
            {/* Rating Badge */}
            {rating && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#CD9F3E" />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* Fit Info */}
          <View style={styles.fitInfo}>
            <Text style={styles.caption} numberOfLines={2}>
              {item.caption || 'No caption'}
            </Text>
            <View style={styles.fitMeta}>
              <Text style={styles.tag}>#{item.tag || 'no-tag'}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
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
        <Ionicons name="shirt-outline" size={48} color="#666" />
      </View>
      <Text style={styles.emptyTitle}>Your Fit Archive</Text>
      <Text style={styles.emptyText}>
        Start sharing your style to build your personal fit collection
      </Text>
      <TouchableOpacity 
        style={styles.postFitButton}
        onPress={() => navigation.navigate('PostFit')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={20} color="#FFFFFF" style={styles.buttonIcon} />
        <Text style={styles.postFitButtonText}>Post Your First Fit</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderHeader = () => (
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
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Profile</Text>
          {userData?.username && (
            <Text style={styles.username}>@{userData.username}</Text>
          )}
          <Text style={styles.headerSubtitle}>
            {myFits.length} fit{myFits.length !== 1 ? 's' : ''} in your archive
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <View style={styles.loadingContent}>
          <Ionicons name="shirt-outline" size={48} color="#666" />
          <Text style={styles.loadingText}>Loading your archive...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {renderHeader()}

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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFFFFF"
                colors={["#FFFFFF"]}
              />
            }
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  
  // Header styles
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  username: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '400',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },

  // Content styles
  content: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 100, // Extra padding for bottom navigation
  },
  row: {
    justifyContent: 'space-between',
  },

  // Fit item styles
  fitItemContainer: {
    width: '48%',
    marginBottom: 20,
  },
  fitItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#333',
  },
  fitImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 2,
  },
  fitInfo: {
    padding: 12,
  },
  caption: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  fitMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tag: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  date: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '400',
  },

  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...theme.shadows.md,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  postFitButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  buttonIcon: {
    marginRight: 8,
  },
  postFitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Loading styles
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
}); 