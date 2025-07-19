import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  Alert,
  Pressable,
  Image,
} from "react-native";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";

export default function CommentInput({ fitId, onCommentAdded, placeholder = "Add a comment..." }) {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfileImageURL, setUserProfileImageURL] = useState(null);

  // Fetch user profile image on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserProfileImageURL(userData.profileImageURL || null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    if (!user) {
      Alert.alert("Error", "You must be logged in to comment.");
      return;
    }
    if (isSubmitting) return; // Prevent double submission

    setIsSubmitting(true);

    try {
      // Get user data for the comment
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      const newComment = {
        id: `${user.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: commentText.trim(),
        userId: user.uid,
        userName: userData.username || userData.displayName || userData.name || "User",
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
      
      // Dismiss keyboard after successful send
      Keyboard.dismiss();
      
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
  const canSend = commentText.trim().length > 0 && !isSubmitting;

  return (
    <View style={styles.inputContainer}>
      {/* User Avatar */}
      <View style={styles.userAvatar}>
        {userProfileImageURL ? (
          <Image 
            source={{ uri: userProfileImageURL }} 
            style={styles.avatarImage}
            defaultSource={require('../../assets/icon.png')}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {(user?.displayName || user?.email || "User").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Input Field */}
      <View style={styles.inputFieldContainer}>
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#71717A"
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          blurOnSubmit={false}
          onSubmitEditing={handleSubmitComment}
        />
      </View>

      {/* Send Button */}
      <Pressable
        style={({ pressed }) => [
          styles.sendButton,
          canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
          pressed && { opacity: 0.8 }
        ]}
        onPress={handleSubmitComment}
        disabled={isSubmitting}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.1)', borderless: false }}
      >
        <Text
          style={[
            styles.sendButtonText,
            canSend ? styles.sendButtonTextActive : styles.sendButtonTextDisabled,
          ]}
        >
          {isSubmitting ? "..." : "→"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputFieldContainer: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  textInput: {
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxHeight: 80,
    textAlignVertical: "top",
  },
  sendButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sendButtonDisabled: {
    backgroundColor: '#666666',
  },
  sendButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  sendButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: "600",
  },
  sendButtonTextDisabled: {
    color: "rgba(255, 255, 255, 0.5)",
  },
  sendButtonTextActive: {
    color: '#FFFFFF',
  },
}); 