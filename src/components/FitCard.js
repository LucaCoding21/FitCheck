import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";

export default function FitCard({ fit }) {
  const { user } = useAuth();
  const [userRating, setUserRating] = useState(
    fit.ratings?.[user?.uid]?.rating || null
  );
  const [hoverRating, setHoverRating] = useState(0);
  const [animatedValues] = useState(
    Array(5).fill().map(() => new Animated.Value(1))
  );
  const [groupRatings, setGroupRatings] = useState({});
  const [fairRating, setFairRating] = useState(0);
  const [userGroups, setUserGroups] = useState([]);

  useEffect(() => {
    calculateFairRating();
    fetchUserGroups();
  }, [fit]);

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
    const diffInHours = Math.floor((now - date.toDate()) / (1000 * 60 * 60));

    if (diffInHours < 1) return "Just now";
    if (diffInHours === 1) return "1 hour ago";
    return `${diffInHours} hours ago`;
  };

  const getGroupBadgeColor = (groupId) => {
    const colors = [
      theme.colors.primary,
      theme.colors.accent,
      theme.colors.fire,
      theme.colors.mid,
    ];
    return colors[parseInt(groupId.slice(-1)) % colors.length];
  };

  const renderStars = (rating, size = 16, interactive = false, onStarPress = null) => {
    const stars = [];
    const displayRating = interactive ? (hoverRating || userRating || 0) : rating;
    
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= displayRating;
      const isSelected = i <= (userRating || 0);
      
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
    <LinearGradient colors={theme.colors.cardGradient} style={styles.container}>
      {/* Enhanced Header with Group Context */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(fit.userName || "User").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>{fit.userName || "User"}</Text>
            <Text style={styles.timestamp}>{formatTimeAgo(fit.createdAt)}</Text>
          </View>
        </View>

        {/* Rating pill in header */}
        {fairRating > 0 && (
          <View style={styles.headerRatingPill}>
            <Text style={styles.headerRatingPillText}>
              {fairRating.toFixed(1)} ★
            </Text>
          </View>
        )}
      </View>

      {/* Image with overlay */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: fit.imageUrl }} style={styles.image} />



        {/* Tag overlay */}
        {fit.tag && (
          <View style={styles.tagOverlay}>
            <LinearGradient
              colors={["rgba(99, 102, 241, 0.8)", "rgba(139, 92, 246, 0.8)"]}
              style={styles.tagGradient}
            >
              <Text style={styles.tagText}>#{fit.tag}</Text>
            </LinearGradient>
          </View>
        )}
      </View>



      {/* Caption */}
      {fit.caption && <Text style={styles.caption}>{fit.caption}</Text>}



      {/* Interactive Rating Buttons */}
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingTitle}>Rate this fit:</Text>
        <View style={styles.ratingBackground}>
          <View style={styles.starsRatingContainer}>
            {renderStars(0, 32, true, rateFit)}
          </View>
          {userRating > 0 && (
            <Text style={styles.ratingLabel}>
              {userRating === 1 ? "Poor" : 
               userRating === 2 ? "Fair" : 
               userRating === 3 ? "Good" : 
               userRating === 4 ? "Great" : "Perfect"}
            </Text>
          )}
        </View>

        {fit.ratingCount > 0 && (
          <View style={styles.ratingStats}>
            <Text style={styles.ratingStatsText}>
              {fit.ratingCount} rating{fit.ratingCount !== 1 ? "s" : ""} • {groupRatings.length} group{groupRatings.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginHorizontal: theme.spacing.md,
    ...theme.shadows.md,
    overflow: "hidden",
  },

  // Header styles
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.sm,
  },
  avatarText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "700",
  },
  userDetails: {
    flexDirection: "column",
    justifyContent: "center",
  },
  username: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "600",
  },
  timestamp: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 2,
  },


  // Star styles
  star: {
    color: theme.colors.textMuted,
  },
  starFilled: {
    color: "#FFD700", // Gold color for filled stars
  },
  starEmpty: {
    color: "rgba(255, 255, 255, 0.3)", // Semi-transparent for empty stars
  },
  starButton: {
    padding: 3,
    marginHorizontal: 2,
  },

  // Header rating pill styles
  headerRatingPill: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerRatingPillText: {
    color: theme.colors.text,
    fontWeight: "600",
    fontSize: 14,
  },

  // Image styles
  imageContainer: {
    position: "relative",
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
    marginHorizontal: theme.spacing.sm,
  },
  image: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: theme.borderRadius.md,
  },
  tagOverlay: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
  },
  tagGradient: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  tagText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: "600",
  },

  // Caption styles
  caption: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    lineHeight: 22,
  },



  // Rating styles
  ratingContainer: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  ratingTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
  },
  ratingBackground: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    ...theme.shadows.sm,
  },
  starsRatingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  ratingLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  ratingStats: {
    alignItems: "center",
    marginTop: theme.spacing.xs,
  },
  ratingStatsText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },

  // New styles for rating overlay
  ratingOverlay: {
    position: "absolute",
    top: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.5)",
    ...theme.shadows.md,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ratingOverlayContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingOverlayText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 16,
    marginRight: theme.spacing.xs,
  },
  ratingOverlayStars: {
    flexDirection: "row",
  },


});
