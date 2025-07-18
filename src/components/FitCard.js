import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ScrollView,
} from "react-native";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";
import Comment from "./Comment";
import CommentInput from "./CommentInput";

export default function FitCard({ fit, onCommentSectionOpen }) {
  const { user } = useAuth();
  const [userRating, setUserRating] = useState(
    fit.ratings?.[user?.uid]?.rating || null
  );
  const [hoverRating, setHoverRating] = useState(0);
  const [animatedValues] = useState(
    Array(5).fill().map(() => new Animated.Value(1))
  );
  const [groupRatings, setGroupRatings] = useState({});
  const [fairRating, setFairRating] = useState(fit.fairRating || 0);
  const [userGroups, setUserGroups] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(fit.comments || []);

  useEffect(() => {
    calculateFairRating();
    fetchUserGroups();
  }, [fit]);

  // Separate useEffect for comments to avoid conflicts with real-time updates
  useEffect(() => {
    if (fit.comments && Array.isArray(fit.comments)) {
      // Deduplicate comments by ID to prevent duplicates
      const uniqueComments = fit.comments.filter((comment, index, self) => 
        index === self.findIndex(c => c.id === comment.id)
      );
      setComments(uniqueComments);
    }
  }, [fit.comments]);

  const fetchUserGroups = async () => {
    try {
      // Fetch user's groups to understand their group membership
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setUserGroups(userDoc.data().groups || []);
      }
    } catch (error) {
      console.error("Error fetching user groups:", error);
    }
  };

  const calculateFairRating = () => {
    if (!fit.ratings || Object.keys(fit.ratings).length === 0) {
      setFairRating(0);
      return;
    }

    // Group ratings by groupId
    const ratingsByGroup = {};
    const groupDetails = {};

    // Process each rating
    Object.entries(fit.ratings).forEach(([userId, ratingData]) => {
      const { rating, groupId, timestamp } = ratingData;
      
      if (!ratingsByGroup[groupId]) {
        ratingsByGroup[groupId] = [];
        groupDetails[groupId] = { name: "Unknown Group", memberCount: 0 };
      }
      
      ratingsByGroup[groupId].push(rating);
    });

    // Calculate average rating per group
    const groupAverages = Object.entries(ratingsByGroup).map(([groupId, ratings]) => {
      const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      return { groupId, average, count: ratings.length };
    });

    // Calculate fair rating (average of group averages)
    if (groupAverages.length > 0) {
      const totalAverage = groupAverages.reduce((sum, group) => sum + group.average, 0);
      const fairRatingValue = totalAverage / groupAverages.length;
      setFairRating(fairRatingValue);
      setGroupRatings(groupAverages);
    }
  };

  const animateStar = (index) => {
    Animated.sequence([
      Animated.timing(animatedValues[index], {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const rateFit = async (rating) => {
    if (!user || fit.userId === user.uid) return;

    // Animate all stars up to the selected rating
    for (let i = 0; i < rating; i++) {
      setTimeout(() => animateStar(i), i * 50);
    }

    try {
      const fitRef = doc(db, "fits", fit.id);
      const previousRating = userRating;

      // Update local state immediately
      setUserRating(rating);

      // Get user's current group context
      const currentGroupId = fit.groupIds?.[0] || "default"; // Use first group for now
      
      // Create rating data with group context
      const ratingData = {
        rating,
        groupId: currentGroupId,
        timestamp: new Date(),
        userId: user.uid
      };

      // Calculate new fair rating
      let newRatings = { ...fit.ratings };
      newRatings[user.uid] = ratingData;

      // Recalculate fair rating
      const ratingsByGroup = {};
      Object.values(newRatings).forEach((ratingData) => {
        const { rating, groupId } = ratingData;
        if (!ratingsByGroup[groupId]) {
          ratingsByGroup[groupId] = [];
        }
        ratingsByGroup[groupId].push(rating);
      });

      const groupAverages = Object.values(ratingsByGroup).map(ratings => 
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      );

      const newFairRating = groupAverages.reduce((sum, avg) => sum + avg, 0) / groupAverages.length;
      const newRatingCount = Object.keys(newRatings).length;

      // Update Firestore
      await updateDoc(fitRef, {
        ratings: newRatings,
        fairRating: newFairRating,
        ratingCount: newRatingCount,
        lastUpdated: new Date(),
      });

      // Update local state
      setFairRating(newFairRating);
      
    } catch (error) {
      console.error("Error rating fit:", error);
      Alert.alert("Error", "Failed to rate fit. Please try again.");
      // Revert local state on error
      setUserRating(previousRating);
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date.toDate()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes === 1) return "1 min ago";
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return "1 hour ago";
    return `${diffInHours} hours ago`;
  };

  const [groupName, setGroupName] = useState("");

  const getGroupName = async (groupId) => {
    if (!groupId) return "";
    
    try {
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        return groupData.name || "Unknown Group";
      }
      return "Unknown Group";
    } catch (error) {
      console.error("Error fetching group name:", error);
      return "Unknown Group";
    }
  };

  // Fetch group name when fit changes
  useEffect(() => {
    const fetchGroupName = async () => {
      if (fit.groupIds && fit.groupIds.length > 0) {
        const name = await getGroupName(fit.groupIds[0]); // Get the first group name
        setGroupName(name);
      }
    };
    
    fetchGroupName();
  }, [fit.groupIds]);

  const handleCommentAdded = (newComment) => {
    // Don't add to local state - let the real-time update handle it
    // This prevents duplicate comments when the fit prop updates
  };

  const toggleComments = () => {
    const newShowComments = !showComments;
    setShowComments(newShowComments);
    
    // If comments are being opened, trigger scroll to this card
    if (newShowComments && onCommentSectionOpen) {
      onCommentSectionOpen(fit.id);
    }
  };

  const renderStars = (rating, size = 16, interactive = false, onStarPress = null) => {
    const stars = [];
    const displayRating = interactive ? (hoverRating || userRating || 0) : rating;
    
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= displayRating;
      
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={interactive ? () => onStarPress(i) : undefined}
          onPressIn={interactive ? () => setHoverRating(i) : undefined}
          onPressOut={interactive ? () => setHoverRating(0) : undefined}
          disabled={!interactive || !user || fit.userId === user.uid}
          style={styles.starButton}
        >
          <Animated.Text
            style={[
              styles.star,
              { fontSize: size },
              isFilled ? styles.starFilled : styles.starEmpty,
              interactive && { transform: [{ scale: animatedValues[i - 1] }] }
            ]}
          >
            ★
          </Animated.Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      {/* User Information Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {fit.userProfileImageURL ? (
              <Image 
                source={{ uri: fit.userProfileImageURL }} 
                style={styles.avatarImage}
                defaultSource={require('../../assets/icon.png')}
              />
            ) : (
              <Text style={styles.avatarText}>
                {(fit.userName || "User").charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>{fit.userName || "lucailliam"}</Text>
            <Text style={styles.timestamp}>
              {formatTimeAgo(fit.createdAt)} • {groupName}
            </Text>
          </View>
        </View>

        {/* Rating Display */}
        {fairRating > 0 && (
          <View style={styles.headerRating}>
            <Text style={styles.starIcon}>★</Text>
            <Text style={styles.ratingText}>
              {fairRating.toFixed(1)} ({fit.ratingCount || 0})
            </Text>
          </View>
        )}
      </View>

      {/* Post Content */}
      {fit.caption && (
        <View style={styles.contentSection}>
          <Text style={styles.caption}>{fit.caption}</Text>
          {fit.hashtags && fit.hashtags.length > 0 && (
            <Text style={styles.hashtags}>
              {fit.hashtags.map(tag => `#${tag}`).join(' ')}
            </Text>
          )}
        </View>
      )}

      {/* Main Image */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: fit.imageUrl }} style={styles.image} />
      </View>

      {/* Rate The Fit Section */}
      <View style={styles.rateSection}>
        <Text style={styles.rateTitle}>Rate The Fit</Text>
        <View style={styles.starsContainer}>
          {renderStars(0, 24, true, rateFit)}
        </View>
      </View>

      {/* Comments Section */}
      <View style={styles.commentsSection}>
        <TouchableOpacity 
          style={styles.commentsHeader} 
          onPress={toggleComments}
        >
          <Text style={styles.commentsCount}>
            {comments.length} Comment{comments.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.commentsToggle}>
            {showComments ? '▼' : '▼'}
          </Text>
        </TouchableOpacity>

        {showComments && (
          <>
            {comments.length > 0 && (
              <ScrollView 
                style={styles.commentsList}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {comments.slice(0, 1).map((comment, index) => (
                  <Comment key={`${fit.id}_${comment.id || `comment_${index}_${comment.userId || 'unknown'}`}`} comment={comment} />
                ))}
              </ScrollView>
            )}
            
            <CommentInput 
              fitId={fit.id} 
              onCommentAdded={handleCommentAdded}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2A2A2A',
    paddingLeft: 0.25,
    paddingRight: 2,
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 1,
    overflow: 'hidden',
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 14,
    color: '#71717A',
  },
  headerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    fontSize: 16,
    color: '#FFD700',
    marginRight: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Content section
  contentSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  caption: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 8,
  },
  hashtags: {
    fontSize: 16,
    color: '#B5483D',
    fontWeight: '600',
  },

  // Image styles
  imageContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 3,
    borderRadius: 8,
  },

  // Rate section
  rateSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  rateTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  starButton: {
    padding: 4,
    marginHorizontal: 2,
  },
  star: {
    color: '#71717A',
  },
  starFilled: {
    color: '#FFD700',
  },
  starEmpty: {
    color: '#71717A',
  },

  // Comments styles
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  commentsCount: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  commentsToggle: {
    fontSize: 16,
    color: '#71717A',
  },
  commentsList: {
    maxHeight: 200,
  },
});
