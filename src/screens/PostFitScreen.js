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
import { LinearGradient } from "expo-linear-gradient";
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

const { width, height } = Dimensions.get('window');

export default function PostFitScreen({ navigation, route }) {
  const { user } = useAuth();
  const [image, setImage] = useState(route.params?.selectedImage || null);
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [userGroups, setUserGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [userName, setUserName] = useState("");
  const [userProfileImageURL, setUserProfileImageURL] = useState("");
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
        tag: tag.trim(),
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

      Alert.alert("Success", "Your fit has been posted!", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error("Error posting fit:", error);
      let errorMessage = "Failed to post fit. Please try again.";

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
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      {/* Clean Header */}
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
          <View style={styles.backButtonContainer}>
            <Text style={styles.backIcon}>←</Text>
          </View>
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
          <View style={[
            styles.postButtonContainer,
            {
              backgroundColor: image && !loading ? theme.colors.primary : theme.colors.textMuted,
            }
          ]}>
            <Text style={styles.postButtonText}>
              {loading ? "Posting..." : "Post"}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

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
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={() => {
                if (!image) {
                  // Navigate back to photo picker
                  navigation.navigate('PostFlow');
                }
              }}
              activeOpacity={image ? 1 : 0.8}
            >
              {image ? (
                <>
                  <OptimizedImage source={{ uri: image }} style={styles.image} />
                  <View style={styles.imageOverlay}>
                    <View style={styles.imageActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => setImage(null)}
                      >
                        <View style={styles.actionButtonContainer}>
                          <Text style={styles.actionIcon}>🗑️</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          // Navigate back to photo picker
                          navigation.navigate('PostFlow');
                        }}
                      >
                        <View style={styles.actionButtonContainer}>
                          <Text style={styles.actionIcon}>🔄</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <View style={styles.placeholderContent}>
                    <View style={styles.placeholderIcon}>
                      <Text style={styles.placeholderEmoji}>📸</Text>
                    </View>
                    <Text style={styles.placeholderTitle}>Add Your Fit</Text>
                    <Text style={styles.placeholderSubtext}>
                      Tap to capture or choose your style
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>



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
                    <View style={styles.quickTagContainer}>
                      <Text style={styles.quickTagText}>#{tag}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAwareContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Header styles
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  backButtonContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: theme.borderRadius.full,
  },
  backIcon: {
    fontSize: 20,
    color: theme.colors.text,
    fontWeight: "600",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: theme.spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    letterSpacing: 0.3,
  },
  postButton: {
    width: 80,
    height: 44,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: theme.borderRadius.lg,
  },
  postButtonText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: "600",
    letterSpacing: 0.5,
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
    paddingBottom: 100, // Add bottom padding for navigator
  },

  // Image section styles
  imageSection: {
    marginBottom: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    ...theme.shadows.md,
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
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: theme.borderRadius.lg,
  },
  imageActions: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    overflow: "hidden",
    ...theme.shadows.md,
  },
  actionButtonContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: theme.borderRadius.full,
  },
  actionIcon: {
    fontSize: 16,
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderStyle: "dashed",
    borderRadius: theme.borderRadius.lg,
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
  placeholderEmoji: {
    fontSize: 32,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.3,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    letterSpacing: 0.3,
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
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  inputHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    letterSpacing: 0.3,
  },

  // Quick tags styles
  quickTagsSection: {
    gap: theme.spacing.sm,
  },
  quickTagsTitle: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: "600",
    paddingHorizontal: theme.spacing.xs,
    letterSpacing: 0.3,
  },
  quickTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  quickTag: {
    borderRadius: theme.borderRadius.full,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  quickTagContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
  },
  quickTagText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});
