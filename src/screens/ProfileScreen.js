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
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';
import OptimizedImage from '../components/OptimizedImage';
import { formatRating } from '../utils/ratingUtils';

const { width } = Dimensions.get('window');
const GRID_SPACING = 4;
const GRID_ITEM_SIZE = (width - (GRID_SPACING * 2)) / 3; // No side padding

// Skeleton Loading Components
const SkeletonView = ({ width, height, style, animatedValue }) => (
  <Animated.View
    style={[
      {
        width,
        height,
        backgroundColor: '#333333',
        borderRadius: 8,
        opacity: animatedValue,
      },
      style,
    ]}
  />
);

const ProfileSkeleton = ({ fadeAnim }) => (
  <View style={styles.skeletonContainer}>
    {/* Profile Image Skeleton */}
    <View style={styles.skeletonProfileImageContainer}>
      <SkeletonView 
        width={120} 
        height={120} 
        style={styles.skeletonProfileImage} 
        animatedValue={fadeAnim} 
      />
    </View>
    
    {/* Username Skeleton */}
    <SkeletonView 
      width={140} 
      height={24} 
      style={styles.skeletonUsername} 
      animatedValue={fadeAnim} 
    />
    
    {/* Fits Count Skeleton */}
    <SkeletonView 
      width={100} 
      height={16} 
      style={styles.skeletonFitsCount} 
      animatedValue={fadeAnim} 
    />
  </View>
);

const FitGridSkeleton = ({ fadeAnim }) => {
  const skeletonItems = Array.from({ length: 9 }, (_, index) => ({ id: `skeleton-${index}` }));
  
  return (
    <View style={styles.fitGrid}>
      {skeletonItems.map((item) => (
        <SkeletonView
          key={item.id}
          width={GRID_ITEM_SIZE}
          height={GRID_ITEM_SIZE}
          style={styles.skeletonGridItem}
          animatedValue={fadeAnim}
        />
      ))}
    </View>
  );
};

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

// Helper function to calculate rating
const calculateRating = (fit) => {
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

  const [userData, setUserData] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(1)); // Start visible
  const unsubscribeRef = useRef(null);

  // Skeleton animation
  const [skeletonAnim] = useState(new Animated.Value(0.3));

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
      fetchFits();
      startSkeletonAnimation();
      
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    } else {
      setMyFits([]);
      setUserData(null);
      setLoading(false);
    }
  }, [user]);

  const startSkeletonAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const fetchUserData = async () => {
    if (!user?.uid) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchFits = async () => {
    if (!user?.uid) return;

    try {
      // Only show loading if we don't have any data yet
      if (myFits.length === 0) {
        setLoading(true);
      }
      
      const fitsQuery = query(
        collection(db, 'fits'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(fitsQuery);
      const fits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setMyFits(fits);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching fits:', error);
      setLoading(false);
    }
  };





  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOutUser();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert(
      'Edit Profile',
      'Edit mode coming soon!',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const renderFitItem = ({ item, index }) => {
    const rating = calculateRating(item);
    
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('FitDetails', { fitId: item.id })}
        activeOpacity={0.9}
        style={styles.fitGridItem}
      >
        <Animated.View
          style={[
            styles.fitImageContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
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
              <Ionicons name="camera-outline" size={24} color="#666" />
            </View>
          )}
          
          {/* Rating Badge */}
          {rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#CD9F3E" />
              <Text style={styles.ratingText}>{formatRating(rating)}</Text>
            </View>
          )}
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

  const renderContent = () => {
    if (loading && myFits.length === 0) {
      return (
        <View style={styles.container}>
          <ProfileSkeleton fadeAnim={skeletonAnim} />
          <FitGridSkeleton fadeAnim={skeletonAnim} />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* Profile Section */}
        <Animated.View
          style={[
            styles.profileSection,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Profile Image with Edit Icon */}
          <View style={styles.profileImageContainer}>
            {userData?.profileImageURL ? (
              <OptimizedImage
                source={{ uri: userData.profileImageURL }}
                style={styles.profileImage}
                contentFit="cover"
                showLoadingIndicator={false}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>
                  {userData?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            
            {/* Edit Icon Overlay */}
            <TouchableOpacity
              style={styles.editIconContainer}
              onPress={handleEditProfile}
              activeOpacity={0.8}
            >
              <View style={styles.editIconBackground}>
                <Ionicons name="pencil" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Username */}
          <Text style={styles.username}>
            {userData?.username || userData?.displayName || user?.email || 'User'}
          </Text>

          {/* Fits Count */}
          <Text style={styles.fitsCount}>
            {myFits.length} Fits saved
          </Text>
        </Animated.View>

        {/* Fits Grid */}
        {myFits.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={myFits}
            keyExtractor={(item) => item.id}
            renderItem={renderFitItem}
            numColumns={3}
            columnWrapperStyle={styles.fitGrid}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.fitList}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Profile section styles
  profileSection: {
    alignItems: 'center',
    paddingBottom: 26,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editIconContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  editIconBackground: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  fitsCount: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
  },

  // Fit grid styles
  fitGrid: {
    justifyContent: 'space-between',
  },
  fitGridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    marginBottom: GRID_SPACING,
  },
  fitImageContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#333333',
  },
  fitImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 2,
  },
  fitList: {
    paddingBottom: 100, // Extra padding for bottom navigation
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
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  postFitButton: {
    backgroundColor: '#B5483D',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  postFitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Skeleton styles
  skeletonContainer: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  skeletonProfileImageContainer: {
    marginBottom: 16,
  },
  skeletonProfileImage: {
    borderRadius: 60,
  },
  skeletonUsername: {
    marginBottom: 8,
    borderRadius: 4,
  },
  skeletonFitsCount: {
    borderRadius: 4,
  },
  skeletonGridItem: {
  },
}); 