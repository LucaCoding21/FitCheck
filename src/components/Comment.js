import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

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
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  avatarText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: "600",
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: "600",
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#71717A',
  },
  commentText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
  },
}); 