import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";
import KeyboardAwareContainer from "../components/KeyboardAwareContainer";
import CaptionInput from "../components/CaptionInput";
import notificationService from "../services/NotificationService";
import OptimizedImage from "../components/OptimizedImage";
import CustomTagModal from "../components/CustomTagModal";
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

export default function PostFitScreen({ navigation, route }) {
  const { user } = useAuth();
  const [image, setImage] = useState(route.params?.selectedImage || null); // image is now the asset object
  const [caption, setCaption] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [userGroups, setUserGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [userName, setUserName] = useState("");
  const [userProfileImageURL, setUserProfileImageURL] = useState("");
  const [fadeAnim] = useState(new Animated.Value(0)); // Start invisible for entrance animation
  const [slideAnim] = useState(new Animated.Value(0)); // Start at right edge for slide-in
  const [scaleAnim] = useState(new Animated.Value(1)); // Start at full scale
  const [showCustomTagModal, setShowCustomTagModal] = useState(false);
  const [userCustomTags, setUserCustomTags] = useState([]);
  const [showAllTags, setShowAllTags] = useState(false);
  
  // ScrollView ref for programmatic scrolling
  const scrollViewRef = useRef(null);

  const defaultTags = ["Casual", "HomeFit", "WorkFit"];
  const availableTags = [...defaultTags, ...userCustomTags];
  
  // Show first 6 tags by default, rest when expanded
  const visibleTags = showAllTags ? availableTags : availableTags.slice(0, 6);
  const hasMoreTags = availableTags.length > 6;

  useEffect(() => {
    // Start heavy operations immediately - no need to defer
    if (user && user.uid) {
      fetchUserProfile();
      fetchUserGroups();
    }
  }, [user]);

  // Entrance animation - this was missing!
  useEffect(() => {
    if (image) {
      // Animate in from right with fade
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [image, fadeAnim, slideAnim]);

  useEffect(() => {
    if (userGroups.length > 0) {
      // Simple, immediate fetch - no deferring
      fetchGroupMembers();
    }
  }, [userGroups]);

  // Add cleanup for animations and prevent memory leaks
  useEffect(() => {
    return () => {
      // Cleanup animations on unmount
      fadeAnim.stopAnimation();
      slideAnim.stopAnimation();
      scaleAnim.stopAnimation();
      
      // Clear any pending timeouts
      if (window.postFitTimeouts) {
        window.postFitTimeouts.forEach(timeout => clearTimeout(timeout));
        window.postFitTimeouts = [];
      }
    };
  }, [fadeAnim, slideAnim, scaleAnim]);

  // Simplified exit animation for smooth transitions
  const animateOut = () => {
    return new Promise((resolve) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150, // Even faster for smoother feel
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -width, // Slide to the left
          duration: 150, // Even faster for smoother feel
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });
  };

  const fetchUserProfile = async () => {
    try {
      if (!user || !user.uid) {
        return;
      }
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserName(userData.username || user.email || "User");
        setUserProfileImageURL(userData.profileImageURL || "");
        setUserCustomTags(userData.customTags || []);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchUserGroups = async () => {
    try {
      if (!user || !user.uid) {
        console.log("User not available yet");
        return;
      }
      
      const groupsQuery = query(
        collection(db, "groups"),
        where("members", "array-contains", user.uid)
      );
      const snapshot = await getDocs(groupsQuery);
      const groups = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUserGroups(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const fetchGroupMembers = async () => {
    try {
      if (!userGroups || userGroups.length === 0) {
        return;
      }
      
      // Collect all member UIDs from all groups
      const allMemberUids = [];
      userGroups.forEach(group => {
        if (group.members && group.members.length > 0) {
          allMemberUids.push(...group.members);
        }
      });
      
      // Remove duplicates and current user
      const uniqueMemberUids = [...new Set(allMemberUids)].filter(uid => uid !== user.uid);
      
      if (uniqueMemberUids.length === 0) {
        setGroupMembers([]);
        return;
      }
      
      // Batch query all members in one call (Firestore supports up to 10 items in 'in' clause)
      const batchSize = 10;
      const members = [];
      
      for (let i = 0; i < uniqueMemberUids.length; i += batchSize) {
        const batch = uniqueMemberUids.slice(i, i + batchSize);
        const usersQuery = query(
          collection(db, "users"),
          where("uid", "in", batch)
        );
        const snapshot = await getDocs(usersQuery);
        snapshot.docs.forEach((doc) => {
          const userData = doc.data();
          members.push({
            id: doc.id,
            name: userData.displayName || userData.email,
            username: userData.username,
          });
        });
      }
      
      setGroupMembers(members);
    } catch (error) {
      console.error("Error fetching group members:", error);
    }
  };

  const uploadImage = async (asset) => {
    try {
      let uploadUri = asset?.localUri || asset?.uri;
      if ((!uploadUri || uploadUri.startsWith('ph://')) && asset?.id) {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
        uploadUri = assetInfo.localUri || assetInfo.uri;
      }
      if (!uploadUri || uploadUri.startsWith('ph://')) {
        throw new Error('Could not resolve a valid file path for the selected photo. Please try a different photo.');
      }
      const response = await fetch(uploadUri);
      const blob = await response.blob();
      const filename = `fits/${user.uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const handleCustomTagAdded = (newTag) => {
    // Add the new tag to local state
    setUserCustomTags(prev => [...prev, newTag]);
    // Automatically select the new tag
    setSelectedTag(newTag);
  };

  const handleCustomTagDeleted = (deletedTag) => {
    // Remove the deleted tag from local state
    setUserCustomTags(prev => prev.filter(tag => tag !== deletedTag));
    // If the deleted tag was selected, clear the selection
    if (selectedTag === deletedTag) {
      setSelectedTag("");
    }
  };

  const handleOpenCustomTagModal = () => {
    setShowCustomTagModal(true);
  };

  const handleToggleTags = () => {
    if (showAllTags) {
      // When collapsing tags, scroll to top
      setShowAllTags(false);
      // Use setTimeout to ensure state update happens before scroll
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    } else {
      // When expanding tags, just show more
      setShowAllTags(true);
    }
  };

  // Custom Toast config (reuse from SignInScreen/GroupDetailsScreen)
  const toastConfig = {
    success: (props) => (
      <BaseToast
        {...props}
        style={{
          backgroundColor: '#2a2a2a',
          borderLeftColor: 'transparent',
          borderRadius: 12,
          minHeight: 48,
          alignItems: 'center',
          shadowOpacity: 0,
          marginHorizontal: 16,
        }}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        text1Style={{
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: '700',
          letterSpacing: 0.5,
        }}
        text2Style={{ color: '#71717A' }}
        renderLeadingIcon={() => (
          <Ionicons name="checkmark-circle" size={22} color="#B5483D" style={{ marginRight: 8 }} />
        )}
      />
    ),
    error: (props) => (
      <ErrorToast
        {...props}
        style={{
          backgroundColor: '#2a2a2a',
          borderLeftColor: 'transparent',
          borderRadius: 12,
          minHeight: 48,
          alignItems: 'center',
          shadowOpacity: 0,
          marginHorizontal: 16,
        }}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        text1Style={{
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: '700',
          letterSpacing: 0.5,
        }}
        text2Style={{ color: '#71717A' }}
        renderLeadingIcon={() => (
          <Ionicons name="close-circle" size={22} color="#FF6B6B" style={{ marginRight: 8 }} />
        )}
      />
    ),
  };

  const postFit = async () => {
    if (!user || !user.uid) {
      Alert.alert("Error", "Please log in to post a fit");
      return;
    }

    if (!image) {
      Alert.alert("Error", "Please add a photo first");
      return;
    }

    if (!userGroups || userGroups.length === 0) {
      Alert.alert("Error", "You need to join at least one group to post a fit");
      return;
    }

    setLoading(true);

    try {
      // Upload image to Firebase Storage
      const imageURL = await uploadImage(image);

      // Create fit document
      const fitData = {
        userId: user.uid,
        userName: userName,
        userEmail: user.email,
        userProfileImageURL: userProfileImageURL,
        imageURL: imageURL,
        caption: caption.trim(),
        tag: selectedTag.trim(),
        groupIds: userGroups.map((group) => group.id),
        ratings: {},
        ratingCount: 0,
        fairRating: 0,
        comments: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
        date: new Date().toISOString().slice(0, 10), // Add date in YYYY-MM-DD format
      };

      const fitDocRef = await addDoc(collection(db, "fits"), fitData);

      // Stronger haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Set flag for HomeScreen to know we just posted
      global.justPostedFit = true;
      console.log('✅ PostFitScreen: Set global.justPostedFit = true');
      
      // Pass the new fit data for optimistic UI update
      global.newPostedFitData = {
        id: fitDocRef.id,
        ...fitData
      };
      
      // Trigger skeleton loading immediately
      global.triggerSkeletonLoading = true;
      console.log('✅ PostFitScreen: Triggering skeleton loading');
      
      // Animate out smoothly with faster timing
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150, // Even faster for smoother feel
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150, // Even faster for smoother feel
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Close the overlay
        if (navigation.goBack) {
          navigation.goBack();
        }
      });
      
      // Show toast after navigation with minimal delay
      setTimeout(() => {
        Toast.show({
          type: 'success',
          text1: 'Fit posted successfully!',
          text2: 'Your fit is now live in the feed',
          position: 'bottom',
          visibilityTime: 3000,
          autoHide: true,
          bottomOffset: 100,
        });
      }, 25); // Minimal delay

      // Send notifications in background with minimal impact
      setTimeout(() => {
        notificationService.sendNewFitNotificationToAllGroups(
          fitDocRef.id,
          userName,
          userGroups
        ).catch(error => {
          console.error('Error sending new fit notifications:', error);
        });
      }, 1000);

    } catch (error) {
      console.error("Error posting fit:", error);
      let errorMessage = "Failed to post fit. Please try again.";

      if (error.message.includes('file path for the selected photo')) {
        errorMessage = "Could not access the selected photo. Please try a different photo from your library.";
      }
      if (error.code === "permission-denied") {
        errorMessage =
          "You don't have permission to post. Please check your account.";
      } else if (error.code === "unavailable") {
        errorMessage =
          "Service temporarily unavailable. Please try again later.";
      } else if (error.message.includes("storage")) {
        errorMessage =
          "Failed to upload image. Please check your connection and try again.";
      } else if (error.message.includes("firestore")) {
        errorMessage = "Database error. Please try again.";
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Safety check for theme
  if (!theme || !theme.colors) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [
            {
              translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [width, 0], // Slide in from right
              }),
            },
          ],
          opacity: fadeAnim,
        },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#222222" />

      {/* Back Button */}
      <TouchableOpacity
        onPress={() => {
          // Prevent multiple taps
          if (loading) return;
          
          // Animate out smoothly
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 200, // Faster animation
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 200, // Faster animation
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Close the overlay
            if (navigation.goBack) {
              navigation.goBack();
            }
          });
        }}
        style={styles.backButton}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <KeyboardAwareContainer style={styles.contentContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          bounces={true}
          nestedScrollEnabled={true}
        >
          {/* Image Section */}
          <View style={styles.imageSection}>
            {image && (image.localUri || image.uri) ? (
              <OptimizedImage 
                source={{ uri: image.localUri || image.uri }} 
                style={styles.image}
                contentFit="cover"
                priority="high"
                cachePolicy="memory-disk"
                transition={100} // Quick transition for responsiveness
                showLoadingIndicator={true} // Show loading indicator for better UX
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={48} color="#71717A" />
                <Text style={styles.placeholderText}>Select a photo</Text>
              </View>
            )}
          </View>

          {/* Caption Section */}
          <View style={styles.captionSection}>
            <Text style={styles.sectionLabel}>Caption</Text>
            <View style={styles.captionInputContainer}>
              <CaptionInput
                value={caption}
                onChangeText={setCaption}
                placeholder="What inspired your outfit today?"
                maxLength={200}
                users={groupMembers || []}
                hashtags={[]}
                onMentionPress={(user) => {
                  console.log("Mentioned user:", user);
                }}
                style={styles.captionInput}
              />
            </View>
          </View>

          {/* Tags Section */}
          <View style={styles.tagsSection}>
            <View style={styles.tagsHeader}>
              <Text style={styles.sectionLabel}>Tags</Text>
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={handleOpenCustomTagModal}
                activeOpacity={0.8}
              >
                <View style={styles.addTagButtonContent}>
                  <Ionicons name="add-circle" size={18} color="#B5483D" />
                  <Text style={styles.addTagText}>Add Custom Tag</Text>
                </View>
              </TouchableOpacity>
            </View>
            
            <View style={styles.tagsContainer}>
              {visibleTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagButton,
                    selectedTag === tag && styles.tagButtonSelected
                  ]}
                  onPress={() => setSelectedTag(selectedTag === tag ? "" : tag)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.tagText,
                    selectedTag === tag && styles.tagTextSelected
                  ]}>
                    #{tag}
                  </Text>
                </TouchableOpacity>
              ))}
              
              {/* Show More/Less Button */}
              {hasMoreTags && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={handleToggleTags}
                  activeOpacity={0.8}
                >
                  <Text style={styles.showMoreText}>
                    {showAllTags ? 'Show Less' : `+${availableTags.length - 6} More`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAwareContainer>

      {/* Post Button */}
      <TouchableOpacity
        onPress={postFit}
        disabled={loading || !image}
        style={[
          styles.postButton,
          (!image || loading) && styles.postButtonDisabled,
        ]}
        activeOpacity={0.8}
      >
        <Text style={styles.postButtonText}>
          {loading ? "Posting..." : "Post"}
        </Text>
      </TouchableOpacity>
      
      {/* Custom Tag Modal */}
      <CustomTagModal
        visible={showCustomTagModal}
        onClose={() => setShowCustomTagModal(false)}
        onTagAdded={handleCustomTagAdded}
        onTagDeleted={handleCustomTagDeleted}
      />
      
      <Toast config={toastConfig} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#222222',
    zIndex: 1001, // Higher than PhotoPicker
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 70, // Space for back button
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 140, // Increased to prevent overlap with post button
  },
  imageSection: {
    aspectRatio: 1,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333333',
    alignSelf: 'center',
    width: width - 40, // Account for horizontal padding
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333',
  },
  placeholderText: {
    color: '#71717A',
    fontSize: 16,
    marginTop: 12,
  },
  captionSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  captionInputContainer: {
    backgroundColor: '#333333',
    borderRadius: 12,
    overflow: 'hidden',
  },
  captionInput: {
    backgroundColor: 'transparent',
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingTop: 1,
    paddingBottom: 28,
    minHeight: 48,
  },
  tagsSection: {
    marginBottom: 20,
  },
  tagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 40, // Ensure minimum height for better touch targets
  },
  tagButton: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  tagButtonSelected: {
    backgroundColor: '#B5483D63',
    borderColor: '#923228',
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#FFFFFF',
  },
  addTagButton: {
    backgroundColor: 'rgba(181, 72, 61, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#B5483D',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addTagButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addTagText: {
    color: '#B5483D',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  showMoreButton: {
    backgroundColor: '#B5483D',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#B5483D',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  showMoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  postButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#D9534F',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#333333',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
