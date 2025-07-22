import React, { useState, useEffect } from "react";
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
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  const availableTags = ["Casual", "HomeFit", "WorkFit", "GymFit"];

  useEffect(() => {
    animateIn();
  }, []);

  useEffect(() => {
    if (user && user.uid) {
      fetchUserGroups();
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (userGroups.length > 0) {
      fetchGroupMembers();
    }
  }, [userGroups]);

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
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
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
      
      const members = [];
      for (const group of userGroups) {
        if (!group.members || group.members.length === 0) {
          continue;
        }
        
        const usersQuery = query(
          collection(db, "users"),
          where("uid", "in", group.members)
        );
        const snapshot = await getDocs(usersQuery);
        snapshot.docs.forEach((doc) => {
          const userData = doc.data();
          if (userData.uid !== user.uid) {
            members.push({
              id: doc.id,
              name: userData.displayName || userData.email,
              username: userData.username,
            });
          }
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
      };

      const fitDocRef = await addDoc(collection(db, "fits"), fitData);

      // Send notifications in the background (don't block UI)
      notificationService.sendNewFitNotificationToAllGroups(
        fitDocRef.id,
        userName,
        userGroups
      ).catch(error => {
        console.error('Error sending new fit notifications:', error);
      });

      // Stronger haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      // Navigate to Home tab in MainTabs and show toast
      navigation.navigate('MainTabs', { screen: 'Home', params: { showPostToast: true } });

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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#222222" />

      {/* Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <KeyboardAwareContainer style={styles.contentContainer}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Image Section */}
          <Animated.View 
            style={[
              styles.imageSection,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}
          >
            {image && (image.localUri || image.uri) ? (
              <OptimizedImage 
                source={{ uri: image.localUri || image.uri }} 
                style={styles.image}
                contentFit="cover"
                priority="high"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={48} color="#71717A" />
                <Text style={styles.placeholderText}>Select a photo</Text>
              </View>
            )}
          </Animated.View>

          {/* Caption Section */}
          <Animated.View 
            style={[
              styles.captionSection,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
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
          </Animated.View>

          {/* Tags Section */}
          <Animated.View 
            style={[
              styles.tagsSection,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.tagsContainer}>
              {availableTags.map((tag) => (
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
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={() => {
                  // Could open a modal to add custom tags
                  console.log("Add custom tag");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.addTagText}>+Add</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
      <Toast config={toastConfig} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222222',
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
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 100,
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
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
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
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    backgroundColor: '#333333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  addTagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
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
