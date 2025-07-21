import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import Comment from '../components/Comment';
import CommentInput from '../components/CommentInput';
import OptimizedImage from '../components/OptimizedImage';

const { width, height } = Dimensions.get('window');

export default function FitDetailsScreen({ navigation, route }) {
  const { fitId } = route.params;
  const { user } = useAuth();
  const [fit, setFit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    fetchFitDetails();
    animateIn();
  }, [fitId]);

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

  const fetchFitDetails = async () => {
    if (!fitId) return;

    try {
      const fitRef = doc(db, 'fits', fitId);
      const unsubscribe = onSnapshot(fitRef, (doc) => {
        if (doc.exists()) {
          setFit({ id: doc.id, ...doc.data() });
        }
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching fit details:', error);
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleCommentAdded = (newComment) => {
    // The fit will be updated automatically via the onSnapshot listener
  };

  const calculateDisplayRating = (fit) => {
    if (fit.fairRating && fit.fairRating > 0) {
      return fit.fairRating.toFixed(1);
    }
    
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

  const renderComment = ({ item, index }) => (
    <Comment comment={item} />
  );

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const commentTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffInMinutes = Math.floor((now - commentTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}hr ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading fit...</Text>
      </View>
    );
  }

  if (!fit) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Fit not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
        {/* Back Button */}
        <Animated.View
          style={[
            styles.backButtonContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Image Section */}
            <View style={styles.imageSection}>
              {fit.imageURL ? (
                <OptimizedImage
                  source={{ uri: fit.imageURL }}
                  style={styles.fitImage}
                  contentFit="cover"
                  priority="high"
                  cachePolicy="memory-disk"
                  transition={300}
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderText}>📸</Text>
                </View>
              )}
            </View>

            {/* User Info & Rating Section */}
            <View style={styles.userInfoSection}>
              <View style={styles.userInfo}>
                <View style={styles.profileContainer}>
                  {fit.userProfileImageURL ? (
                    <OptimizedImage
                      source={{ uri: fit.userProfileImageURL }}
                      style={styles.profileImage}
                      contentFit="cover"
                      showLoadingIndicator={false}
                    />
                  ) : (
                    <View style={styles.placeholderProfile}>
                      <Text style={styles.placeholderProfileText}>👤</Text>
                    </View>
                  )}
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.username}>{fit.userName || 'Anonymous'}</Text>
                  <Text style={styles.groupName}>Kappa Group</Text>
                </View>
              </View>
              <View style={styles.ratingContainer}>
                <Text style={styles.starIcon}>★</Text>
                <Text style={styles.ratingText}>
                  {calculateDisplayRating(fit)}
                  <Text style={styles.ratingCount}>
                    ({fit.ratingCount || 0})
                  </Text>
                </Text>
              </View>
            </View>

            {/* Description Section */}
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionText}>
                {fit.caption || 'Lorem ipsum dolor sit amet consectetur. Adipiscing neque eros donec lectus turpis sit.'}
              </Text>
              <Text style={styles.hashtag}>
                #{fit.tag || 'workfit'}
              </Text>
            </View>

            {/* Comments Section */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsHeader}>
                {fit.comments?.length || 0} comment{(fit.comments?.length || 0) !== 1 ? 's' : ''}
              </Text>
              
              {fit.comments && fit.comments.length > 0 ? (
                <View style={styles.commentsList}>
                  {fit.comments.map((comment, index) => (
                    <Comment key={`comment-${index}`} comment={comment} />
                  ))}
                </View>
              ) : (
                <View style={styles.noCommentsContainer}>
                  <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </ScrollView>

        {/* Fixed Comment Input at Bottom */}
        <View style={styles.commentInputContainer}>
          <CommentInput 
            fitId={fit.id} 
            onCommentAdded={handleCommentAdded}
            placeholder="Add a comment"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  keyboardContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  loadingText: {
    fontSize: 16,
    color: '#CCCCCC',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  errorText: {
    fontSize: 16,
    color: '#CCCCCC',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 20, // Adjusted for SafeAreaView
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20, // Add space above comment input
  },
  content: {
    // Remove flex: 1 to allow content to expand naturally
  },
  imageSection: {
    width: '100%',
    height: height * 0.58, // Reduced to 58% for more compact layout
    backgroundColor: '#000000',
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
    fontSize: 48,
  },
  userInfoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16, // Reduced padding for more compact layout
    backgroundColor: '#1A1A1A',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
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
  placeholderProfileText: {
    fontSize: 20,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  groupName: {
    fontSize: 13,
    color: '#71717A',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    fontSize: 18,
    color: '#FFD700',
    marginRight: 4,
  },
  ratingText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '400',
  },
  descriptionSection: {
    paddingHorizontal: 20,
    paddingVertical: 16, // Reduced padding for more compact layout
    backgroundColor: '#1A1A1A',
  },
  descriptionText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 6,
  },
  hashtag: {
    fontSize: 15,
    color: '#B5483D',
    fontWeight: '600',
  },
  commentsSection: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commentsHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  commentsList: {
    // No specific styles needed for FlatList contentContainer
  },
  noCommentsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noCommentsText: {
    fontSize: 15,
    color: '#71717A',
    textAlign: 'center',
  },
  commentInputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 20,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    // Ensure it stays at the bottom
    position: 'relative',
    zIndex: 1,
  },
}); 