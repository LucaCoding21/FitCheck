import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";
import KeyboardAwareContainer from "../components/KeyboardAwareContainer";
import CaptionInput from "../components/CaptionInput";
import * as ImagePicker from "expo-image-picker";

const { width, height } = Dimensions.get('window');

export default function PostFitScreen({ navigation, route }) {
  const { user } = useAuth();
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [userGroups, setUserGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [userName, setUserName] = useState("");
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [popularHashtags] = useState([
    "ootd",
    "style",
    "fashion",
    "casual",
    "formal",
    "streetwear",
    "vintage",
    "trendy",
    "outfit",
    "look",
    "vibe",
    "aesthetic",
  ] || []);

  useEffect(() => {
    animateIn();
  }, []);

  useEffect(() => {
    if (user && user.uid) {
      fetchUserGroups();
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

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        setShowImageOptions(false);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera permissions");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        setShowImageOptions(false);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const uploadImage = async (uri) => {
    try {
      const response = await fetch(uri);
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
      const imageUrl = await uploadImage(image);
      const userGroupIds = userGroups.map((group) => group.id);

      // Prepare the base document data
      const baseFitData = {
        userId: user.uid,
        userName: userName,
        imageUrl: imageUrl,
        caption: caption.trim() || "",
        tag: tag.trim() || "",
        createdAt: new Date(),
        ratings: {},
        fairRating: 0,
        ratingCount: 0,
        platform: "mobile",
        version: "1.0",
      };

      console.log("Posting fit to groups:", userGroupIds);

      // Create a single fit document with all group IDs
      const fitData = {
        ...baseFitData,
        groupIds: userGroupIds, // Store all group IDs in one field
      };

      const docRef = await addDoc(collection(db, "fits"), fitData);
      console.log(`Fit posted successfully to ${userGroupIds.length} groups`);

      // Clear form
      setImage(null);
      setCaption("");
      setTag("");
      setShowImageOptions(false);

      Alert.alert("Success", "Your fit has been posted! 🔥", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error("Error posting fit:", error);

      // More specific error messages
      let errorMessage = "Failed to post your fit. Please try again.";

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
    <LinearGradient
      colors={[theme.colors.background, theme.colors.surface]}
      style={styles.container}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.background}
      />

      {/* Cool Animated Header */}
      <Animated.View 
        style={[
          styles.header,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <LinearGradient
            colors={theme.colors.surfaceGradient || [theme.colors.surface, theme.colors.card]}
            style={styles.backButtonGradient}
          >
            <Text style={styles.backIcon}>←</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>Share Your Fit</Text>
          <Text style={styles.subtitle}>Show your style to the crew</Text>
        </View>

        <TouchableOpacity
          onPress={postFit}
          disabled={loading || !image}
          style={[
            styles.postButton,
            (!image || loading) && styles.postButtonDisabled,
          ]}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              image && !loading
                ? theme.colors.accentGradient
                : [theme.colors.textMuted, theme.colors.textMuted]
            }
            style={styles.postButtonGradient}
          >
            <Text style={styles.postButtonText}>
              {loading ? "Posting..." : "Post"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <KeyboardAwareContainer
        behavior="padding"
        keyboardVerticalOffset={0}
        style={styles.contentContainer}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Hero Image Section */}
          <Animated.View 
            style={[
              styles.heroSection,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}
          >
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={() => !image && setShowImageOptions(true)}
              activeOpacity={image ? 1 : 0.8}
            >
              {image ? (
                <>
                  <Image source={{ uri: image }} style={styles.image} />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.imageOverlay}
                  >
                    <View style={styles.imageActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => setImage(null)}
                      >
                        <LinearGradient
                          colors={theme.colors.dangerGradient || [theme.colors.error, theme.colors.error]}
                          style={styles.actionButtonGradient}
                        >
                          <Text style={styles.actionIcon}>🗑️</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => setShowImageOptions(true)}
                      >
                        <LinearGradient
                          colors={theme.colors.primaryGradient || [theme.colors.primary, theme.colors.secondary]}
                          style={styles.actionButtonGradient}
                        >
                          <Text style={styles.actionIcon}>🔄</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </>
              ) : (
                <LinearGradient
                  colors={theme.colors.cardGradient}
                  style={styles.imagePlaceholder}
                >
                  <View style={styles.placeholderContent}>
                    <View style={styles.placeholderIcon}>
                      <LinearGradient
                        colors={theme.colors.accentGradient || [theme.colors.accent, theme.colors.accent]}
                        style={styles.placeholderIconGradient}
                      >
                        <Text style={styles.placeholderEmoji}>📸</Text>
                      </LinearGradient>
                    </View>
                    <Text style={styles.placeholderTitle}>Add Your Fit</Text>
                    <Text style={styles.placeholderSubtext}>
                      Tap to capture or choose your style
                    </Text>
                  </View>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Photo Source Options */}
          {(!image || showImageOptions) && (
            <Animated.View 
              style={[
                styles.photoOptions,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              <TouchableOpacity
                style={styles.photoOption}
                onPress={async () => {
                  setShowImageOptions(false);
                  await takePhoto();
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={theme.colors.primaryGradient || [theme.colors.primary, theme.colors.secondary]}
                  style={styles.photoOptionGradient}
                >
                  <View style={styles.photoOptionContent}>
                    <Text style={styles.photoOptionIcon}>📷</Text>
                    <Text style={styles.photoOptionText}>Camera</Text>
                    <Text style={styles.photoOptionSubtext}>
                      Take new photo
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoOption}
                onPress={async () => {
                  setShowImageOptions(false);
                  await pickImage();
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[theme.colors.secondary, theme.colors.accent]}
                  style={styles.photoOptionGradient}
                >
                  <View style={styles.photoOptionContent}>
                    <Text style={styles.photoOptionIcon}>🖼️</Text>
                    <Text style={styles.photoOptionText}>Gallery</Text>
                    <Text style={styles.photoOptionSubtext}>
                      Choose existing
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Form Section */}
          <Animated.View 
            style={[
              styles.formSection,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* Caption Input */}
            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputLabel}>💬 Caption</Text>
                <Text style={styles.inputHint}>Tag friends with @</Text>
              </View>
              <CaptionInput
                value={caption || ""}
                onChangeText={setCaption}
                placeholder="What's the vibe? Share your style story..."
                maxLength={200}
                users={groupMembers || []}
                hashtags={popularHashtags || []}
                onMentionPress={(user) => {
                  console.log("Mentioned user:", user);
                }}
              />
            </View>

            {/* Tag Input */}
            <View style={styles.inputGroup}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputLabel}>🏷️ Occasion</Text>
                <Text style={styles.inputHint}>What's the vibe?</Text>
              </View>
              <CaptionInput
                value={tag || ""}
                onChangeText={setTag}
                placeholder="casual, formal, date night, school..."
                maxLength={50}
                hashtags={popularHashtags || []}
                onMentionPress={(hashtag) => {
                  console.log("Selected hashtag:", hashtag);
                }}
              />
            </View>

            {/* Quick Tags */}
            <View style={styles.quickTagsSection}>
              <Text style={styles.quickTagsTitle}>Quick Tags</Text>
              <View style={styles.quickTagsContainer}>
                {(["casual", "formal", "date", "school", "party", "work"] || []).map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.quickTag}
                    onPress={() => setTag(tag)}
                  >
                    <LinearGradient
                      colors={theme.colors.surfaceGradient}
                      style={styles.quickTagGradient}
                    >
                      <Text style={styles.quickTagText}>#{tag}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAwareContainer>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Enhanced Header styles
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  backButtonGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  backIcon: {
    ...theme.typography.h3,
    color: theme.colors.textSecondary,
    fontSize: 20,
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: "700",
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  postButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonGradient: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  postButtonText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 14,
  },

  // Content container styles
  contentContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.md,
  },

  // Hero section styles
  heroSection: {
    marginBottom: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    overflow: "hidden",
    ...theme.shadows.lg,
  },
  imageContainer: {
    aspectRatio: 3 / 4,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.xl,
  },
  imageActions: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonGradient: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  actionIcon: {
    fontSize: 16,
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderStyle: "dashed",
  },
  placeholderContent: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  placeholderIcon: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  placeholderIconGradient: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  placeholderEmoji: {
    fontSize: 32,
  },
  placeholderTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontWeight: "600",
  },
  placeholderSubtext: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },

  // Photo options styles
  photoOptions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  photoOption: {
    flex: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  photoOptionGradient: {
    padding: theme.spacing.md,
    alignItems: "center",
  },
  photoOptionContent: {
    alignItems: "center",
  },
  photoOptionIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  photoOptionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "600",
    marginBottom: 2,
  },
  photoOptionSubtext: {
    ...theme.typography.caption,
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
  },

  // Form section styles
  formSection: {
    gap: theme.spacing.lg,
  },
  inputGroup: {
    gap: theme.spacing.sm,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xs,
  },
  inputLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "600",
  },
  inputHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  tagInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    fontSize: 16,
    color: theme.colors.text,
    ...theme.shadows.sm,
    minHeight: 50,
  },

  // Quick tags styles
  quickTagsSection: {
    gap: theme.spacing.sm,
  },
  quickTagsTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "600",
    paddingHorizontal: theme.spacing.xs,
  },
  quickTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  quickTag: {
    borderRadius: theme.borderRadius.full,
  },
  quickTagGradient: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  quickTagText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
});
