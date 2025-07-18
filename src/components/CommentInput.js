import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  Alert,
} from "react-native";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";

export default function CommentInput({ fitId, onCommentAdded }) {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    if (!user) {
      Alert.alert("Error", "You must be logged in to comment.");
      return;
    }
    if (isSubmitting) return; // Prevent double submission

    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      // Get user data for the comment
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      const newComment = {
        id: `${user.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: commentText.trim(),
        userId: user.uid,
        userName: userData.name || userData.displayName || "User",
        userProfileImageURL: userData.profileImageURL || null,
        timestamp: new Date(),
      };

      // Update the fit document with the new comment
      const fitRef = doc(db, "fits", fitId);
      await updateDoc(fitRef, {
        comments: arrayUnion(newComment),
        lastUpdated: new Date(),
      });

      // Clear input and notify parent component
      setCommentText("");
      if (onCommentAdded) {
        onCommentAdded(newComment);
      }
      
      // Small delay to prevent rapid submissions
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment. Please try again.");
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled = !commentText.trim() || isSubmitting;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Add a comment..."
          placeholderTextColor={theme.colors.textMuted}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          blurOnSubmit={false}
          onSubmitEditing={handleSubmitComment}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            isSubmitDisabled && styles.sendButtonDisabled,
          ]}
          onPress={handleSubmitComment}
          disabled={isSubmitDisabled}
        >
          <Text
            style={[
              styles.sendButtonText,
              isSubmitDisabled && styles.sendButtonTextDisabled,
            ]}
          >
            {isSubmitting ? "..." : "Send"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: theme.colors.surface,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  textInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    maxHeight: 100,
    textAlignVertical: "top",
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.textMuted,
  },
  sendButtonText: {
    ...theme.typography.small,
    color: theme.colors.text,
    fontWeight: "600",
  },
  sendButtonTextDisabled: {
    color: "rgba(255, 255, 255, 0.5)",
  },
}); 