import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";

export default function FitCard({ fit, onCommentSectionOpen, onOpenCommentModal }) {
  const { user } = useAuth();
  const [userRating, setUserRating] = useState(
    fit.ratings?.[user?.uid]?.rating || null
  );
  const [hoverRating, setHoverRating] = useState(0);
  const [groupRatings, setGroupRatings] = useState({});
  const [fairRating, setFairRating] = useState(fit.fairRating || 0);
  const [ratingCount, setRatingCount] = useState(fit.ratingCount || 0);
  const [userGroups, setUserGroups] = useState([]);
  const [comments, setComments] = useState(fit.comments || []);
  const [groupName, setGroupName] = useState("");
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    calculateFairRating();
    fetchUserGroups();
    setRatingCount(fit.ratingCount || 0);
    // Use the user data that's already stored in the fit document
    if (fit.userName || fit.userProfileImageURL) {
      setUserData({
        username: fit.userName,
        displayName: fit.userName,
        profileImageURL: fit.userProfileImageURL,
        email: fit.userEmail
      });
    } else {
      // Fallback to fetching from users collection if data not in fit
      fetchUserData();
    }
  }, [fit]);

  // Separate useEffect for comments to avoid conflicts with real-time updates
  useEffect(() => {
    if (fit.comments && Array.isArray(fit.comments)) {
      // Deduplicate comments by ID to prevent duplicates
      const uniqueComments = fit.comments.filter((comment, index, self) => 
        comment && comment.id && index === self.findIndex(c => c && c.id === comment.id)
      );
      setComments(uniqueComments);
    } else {
      setComments([]);
    }
  }, [fit.comments]);

  const fetchUserData = async () => {
    try {
      if (fit.userId) {
        const userDoc = await getDoc(doc(db, "users", fit.userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserData(userData);
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

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

    const ratings = Object.values(fit.ratings)
      .filter(r => r && typeof r.rating === 'number')
      .map(r => r.rating);
    
    if (ratings.length === 0) {
      setFairRating(0);
      return;
    }
    
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    setFairRating(Math.round(average * 10) / 10);
  };

  // Calculate fair rating with immediate user rating update
  const calculateFairRatingWithUserRating = (userRatingValue) => {
    if (!fit.ratings || Object.keys(fit.ratings).length === 0) {
      return userRatingValue || 0;
    }

    // Create a copy of ratings and add/update the user's rating
    const ratingsCopy = { ...fit.ratings };
    if (userRatingValue) {
      ratingsCopy[user.uid] = { rating: userRatingValue, timestamp: new Date() };
    }

    const ratings = Object.values(ratingsCopy)
      .filter(r => r && typeof r.rating === 'number')
      .map(r => r.rating);
    
    if (ratings.length === 0) {
      return userRatingValue || 0;
    }
    
    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    return Math.round(average * 10) / 10;
  };

  const rateFit = async (rating) => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to rate fits.");
      return;
    }

    // Check if user is trying to rate their own fit
    if (fit.userId === user.uid) {
      Alert.alert("Cannot Rate Own Fit", "You cannot rate your own fit.");
      return;
    }

    try {
      // Update local state immediately for better UX
      setUserRating(rating);
      
      // Update fair rating immediately with new user rating
      const newFairRating = calculateFairRatingWithUserRating(rating);
      setFairRating(newFairRating);
      
      // Check if this is a new rating or updating existing rating
      const existingRating = fit.ratings?.[user.uid];
      const isNewRating = !existingRating;
      
      // Update rating count if this is a new rating
      if (isNewRating) {
        setRatingCount(prev => prev + 1);
      }

      // Update the fit document
      const fitRef = doc(db, "fits", fit.id);
      
      // Calculate new rating count
      const currentRatingCount = fit.ratingCount || 0;
      const newRatingCount = isNewRating ? currentRatingCount + 1 : currentRatingCount;
      
      await updateDoc(fitRef, {
        [`ratings.${user.uid}`]: {
          rating: rating,
          timestamp: new Date(),
        },
        ratingCount: newRatingCount,
        fairRating: newFairRating,
        lastUpdated: new Date(),
      });

    } catch (error) {
      console.error("Error rating fit:", error);
      Alert.alert("Error", "Failed to rate fit. Please try again.");
      // Revert local state on error
      setUserRating(fit.ratings?.[user?.uid]?.rating || null);
      calculateFairRating(); // Recalculate without user rating
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return "Just now";
    
    const now = new Date();
    let commentDate;
    
    // Handle both Firestore Timestamp and regular Date objects
    if (date.toDate && typeof date.toDate === 'function') {
      commentDate = date.toDate();
    } else if (date instanceof Date) {
      commentDate = date;
    } else {
      commentDate = new Date(date);
    }
    
    const diffInMinutes = Math.floor((now - commentDate) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes === 1) return "1 min ago";
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return "1 hour ago";
    return `${diffInHours} hours ago`;
  };

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

  const openCommentModal = () => {
    // Notify parent component to open the modal
    if (onOpenCommentModal) {
      onOpenCommentModal(fit, comments);
    }
    
    // Trigger scroll to this card
    if (onCommentSectionOpen) {
      onCommentSectionOpen(fit.id);
    }
  };

  const renderStars = (rating, size = 16, interactive = false, onStarPress = null) => {
    return Array(5).fill().map((_, index) => {
      const starValue = index + 1;
      const isFilled = starValue <= rating;
      const isHovered = interactive && starValue <= hoverRating;
      
      const baseStyle = [
        styles.star,
        { fontSize: size },
        isFilled || isHovered ? styles.starFilled : styles.starEmpty,
      ];

      if (interactive) {
        return (
          <TouchableOpacity
            key={index}
            style={styles.starButton}
            onPress={() => onStarPress && onStarPress(starValue)}
            onPressIn={() => setHoverRating(starValue)}
            onPressOut={() => setHoverRating(0)}
          >
            <Text style={baseStyle}>★</Text>
          </TouchableOpacity>
        );
      }

      return (
        <Text key={index} style={baseStyle}>
          ★
        </Text>
      );
    });
  };

  // Get user display info with fallbacks
  const getUserDisplayName = () => {
    if (userData?.username) {
      return userData.username;
    }
    if (userData?.displayName) {
      return userData.displayName;
    }
    if (userData?.email) {
      return userData.email.split('@')[0];
    }
    // Fallback to fit data if userData is not available
    if (fit.userName) {
      return fit.userName;
    }
    return "User";
  };

  const getUserProfileImage = () => {
    if (userData?.profileImageURL) return userData.profileImageURL;
    // Fallback to fit data if userData is not available
    if (fit.userProfileImageURL) return fit.userProfileImageURL;
    return null;
  };



  // Loading state for user profile - only show if we have no user data at all
  if (!userData && !fit.userName && !fit.userProfileImageURL) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', minHeight: 200 }]}> 
        <Text style={{ color: '#fff', opacity: 0.5 }}>Loading user...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {getUserProfileImage() ? (
            <Image
              source={{ uri: getUserProfileImage() }}
              style={styles.avatarImage}
              defaultSource={require("../../assets/icon.png")}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getUserDisplayName().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.username}>
              {getUserDisplayName()}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimeAgo(fit.createdAt || fit.timestamp)} • {groupName}
            </Text>
          </View>
        </View>
        <View style={styles.headerRating}>
          <Text style={styles.starIcon}>★</Text>
          <Text style={styles.ratingText}>
            {fairRating.toFixed(1)} 
            <Text style={styles.ratingCount}>
              ({ratingCount})
            </Text>
          </Text>
        </View>
      </View>

      {/* Caption */}
      {(fit.caption || fit.tag) && (
        <View style={styles.contentSection}>
          {fit.caption && (
            <Text style={styles.caption}>{fit.caption}</Text>
          )}
          {fit.tag && (
            <Text style={styles.hashtags}>
              {fit.tag.split(/[,\s]+/).filter(tag => tag.trim()).map(tag => `#${tag.trim()}`).join(' ')}
            </Text>
          )}
        </View>
      )}

      {/* Main Image */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: fit.imageURL }} style={styles.image} />
      </View>

      {/* Rate The Fit Section */}
      <View style={styles.rateSection}>
        {fit.userId === user?.uid ? (
          // User's own fit - show rating info only
          <View style={styles.ownFitSection}>
            <Text style={styles.rateTitle}>Your Fit Rating</Text>
            <View style={styles.starsContainer}>
              {renderStars(fairRating, 32, false)}
            </View>
            <Text style={styles.ratingFeedback}>
              Average: {fairRating.toFixed(1)} stars ({ratingCount} ratings)
            </Text>
          </View>
        ) : (
          // Other user's fit - show interactive rating
          <>
            <Text style={styles.rateTitle}>Rate The Fit</Text>
            <View style={styles.starsContainer}>
              {renderStars(userRating || 0, 32, true, rateFit)}
            </View>
            {userRating && (
              <Text style={styles.ratingFeedback}>
                You rated this fit {userRating} star{userRating !== 1 ? 's' : ''}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Comment Section */}
      <View style={styles.actionSection}>
        <TouchableOpacity 
          style={styles.commentButton}
          onPress={openCommentModal}
          activeOpacity={0.6}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" style={styles.commentIcon} />
          <Text style={styles.commentText}>
            {comments.length}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 8,
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
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
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 2,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  timestamp: {
    fontSize: 14,
    color: '#71717A',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  headerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    fontSize: 20,
    color: '#FFD700',
    marginRight: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '400',
  },

  // Content section
  contentSection: {
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
    color: '#FF6B6B',
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Image styles
  imageContainer: {
    marginBottom: 16,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 3,
    borderRadius: 8,
  },

  // Rate section
  rateSection: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  ownFitSection: {
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
  ratingFeedback: {
    fontSize: 14,
    color: '#71717A',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Comment section styles
  actionSection: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    minWidth: 60,
  },
  commentIcon: {
    marginRight: 8,
  },
  commentButtonPressed: {
    opacity: 0.7,
  },
  commentText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 1,
  },
});
