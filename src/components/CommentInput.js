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
} from "react-native";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";
import notificationService from "../services/NotificationService";
import OptimizedImage from "./OptimizedImage";
import { Ionicons } from '@expo/vector-icons';

export default function CommentInput({ fitId, onCommentAdded, placeholder = "Add a comment...", onFocus }) {
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

      // Send notification to fit owner
      try {
        const fitDoc = await getDoc(fitRef);
        if (fitDoc.exists()) {
          const fitData = fitDoc.data();
          const fitOwnerId = fitData.userId;
          const commenterName = userData.username || userData.displayName || userData.name || "User";
          
          await notificationService.sendCommentNotification(fitId, commenterName, fitOwnerId);
        }
      } catch (error) {
        console.error('Error sending comment notification:', error);
      }

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

  const handleInputFocus = () => {
    if (onFocus) {
      onFocus();
    }
  };

  const isSubmitDisabled = !commentText.trim() || isSubmitting;
  const canSend = commentText.trim().length > 0 && !isSubmitting;

  return (
    <View style={styles.outerContainer}>
      <View style={styles.inputContainer}>
        {/* User Avatar */}
        <View style={styles.userAvatar}>
          {userProfileImageURL ? (
            <OptimizedImage 
              source={{ uri: userProfileImageURL }} 
              style={styles.avatarImage}
              placeholder={require('../../assets/icon.png')}
              showLoadingIndicator={false}
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
            placeholderTextColor={theme.colors.textMuted || '#71717A'}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            blurOnSubmit={false}
            onSubmitEditing={handleSubmitComment}
            onFocus={handleInputFocus}
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
          disabled={isSubmitting || !canSend}
          android_ripple={{ color: 'rgba(255, 255, 255, 0.1)', borderless: false }}
        >
          <Ionicons
            name="arrow-up-circle"
            size={22}
            color={'#fff'}
            style={styles.sendIcon}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: theme.colors.background,
    paddingBottom: 0,
    paddingTop: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: 'transparent',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 0,
    overflow: 'hidden',
    marginLeft: -15,
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
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputFieldContainer: {
    flex: 1,
    backgroundColor: '#232323',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 4,
    minHeight: 40,
    maxHeight: 90,
    justifyContent: 'center',
    paddingVertical: 0,
  },
  textInput: {
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
    maxHeight: 90,
    textAlignVertical: 'center',
    backgroundColor: 'transparent',
  },
  sendButton: {
    width: 70,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    paddingRight: 10,
    paddingLeft: 10,
    marginLeft: 0,
    marginRight: -15,
  },
  sendButtonDisabled: {
    backgroundColor: '#666666',
    opacity: 0.5,
  },
  sendButtonActive: {
    backgroundColor: theme.colors.primary,
    opacity: 1,
  },
  sendIcon: {
    marginLeft: 0,
  },
}); 