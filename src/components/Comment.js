import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { theme } from "../styles/theme";

export default function Comment({ comment }) {
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
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return commentDate.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        {comment.userProfileImageURL ? (
          <Image 
            source={{ uri: comment.userProfileImageURL }} 
            style={styles.avatarImage}
            defaultSource={require('../../assets/icon.png')}
          />
        ) : (
          <Text style={styles.avatarText}>
            {(comment.userName || "User").charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.username}>{comment.userName || "User"}</Text>
          <Text style={styles.timestamp}>{formatTimeAgo(comment.timestamp)}</Text>
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.sm,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: theme.borderRadius.full,
  },
  avatarText: {
    ...theme.typography.small,
    color: theme.colors.text,
    fontWeight: "700",
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  username: {
    ...theme.typography.small,
    color: theme.colors.text,
    fontWeight: "600",
    marginRight: theme.spacing.sm,
  },
  timestamp: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  commentText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
}); 