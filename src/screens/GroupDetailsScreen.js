import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import { theme } from '../styles/theme';

export default function GroupDetailsScreen({ navigation, route }) {
  const { user } = useAuth();
  const { groupId, groupName } = route.params;
  
  const [groupImage, setGroupImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [groupData, setGroupData] = useState(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const imageScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    fetchUserData();
    fetchGroupData();
    
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(imageScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchUserData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchGroupData = async () => {
    try {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (groupDoc.exists()) {
        const data = groupDoc.data();
        setGroupData(data);
        // If group has an existing image, set it
        if (data.groupImageURL) {
          setGroupImage(data.groupImageURL);
        }
      }
    } catch (error) {
      console.error('Error fetching group data:', error);
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to select a group picture.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setGroupImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImageToFirebase = async (imageUri) => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const imageRef = ref(storage, `group-images/${groupId}`);
      await uploadBytes(imageRef, blob);
      
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    
    try {
      let groupImageURL = null;
      
      // Upload image if selected
      if (groupImage) {
        try {
          groupImageURL = await uploadImageToFirebase(groupImage);
          
          // Update group document with image URL
          await updateDoc(doc(db, 'groups', groupId), {
            groupImageURL,
            updatedAt: new Date(),
          });
        } catch (uploadError) {
          console.error('Image upload failed, continuing without image:', uploadError);
          Alert.alert(
            'Image Upload Failed', 
            'Your group will be created without a group picture. You can add one later.',
            [{ text: 'OK' }]
          );
        }
      }

      // Navigate to Main screen with the newly created group selected
      navigation.replace("Main", { selectedGroup: groupId });
    } catch (error) {
      console.error('Error updating group:', error);
      Alert.alert('Error', 'Failed to update group. Please try again.');
    }
    setLoading(false);
  };



  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("MainTabs", { screen: "Groups" })}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>{groupName}</Text>
        
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => Alert.alert('Menu', 'Menu options coming soon')}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </Animated.View>

      {/* Group Info */}
      <Animated.View
        style={[
          styles.groupInfo,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.memberCount}>{groupData?.memberCount || 1} member{groupData?.memberCount !== 1 ? 's' : ''}</Text>
      </Animated.View>

      {/* Group Profile Picture */}
      <Animated.View
        style={[
          styles.imageSection,
          {
            opacity: fadeAnim,
            transform: [{ scale: imageScale }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.groupImageContainer}
          onPress={groupImage ? null : pickImage}
          activeOpacity={groupImage ? 1 : 0.8}
        >
          {groupImage ? (
            <OptimizedImage source={{ uri: groupImage }} style={styles.groupImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>add photo</Text>
            </View>
          )}
          {!groupImage && (
            <View style={styles.imageOverlay}>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
        
        {/* Activity indicator */}
        <View style={styles.activityContainer}>
          <Text style={styles.activityIcon}>🔥</Text>
          <Text style={styles.activityText}>0</Text>
        </View>
      </Animated.View>

      {/* Members List */}
      <Animated.View
        style={[
          styles.membersSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.membersTitle}>Members</Text>
        
        {/* Creator as first member */}
        <View style={styles.memberItem}>
          <View style={styles.memberAvatar}>
            {userData?.profileImageURL ? (
              <OptimizedImage
                source={{ uri: userData.profileImageURL }}
                style={styles.memberImage}
                showLoadingIndicator={false}
              />
            ) : (
              <Text style={styles.memberAvatarText}>
                {userData?.username?.charAt(0).toUpperCase() || 'U'}
              </Text>
            )}
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{userData?.username || 'User'}</Text>
            <Text style={styles.memberStatus}>Posted</Text>
          </View>
        </View>
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View
        style={[
          styles.buttonSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.continueButton,
            loading && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>
            {loading ? 'Updating...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  groupInfo: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  memberCount: {
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  groupImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  groupImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3a3a3a',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '500',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
  },
  activityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityIcon: {
    fontSize: 16,
  },
  activityText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  membersSection: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  membersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  memberImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  memberStatus: {
    fontSize: 14,
    color: '#CD9F3E',
    fontWeight: '500',
  },
  buttonSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonDisabled: {
    opacity: 0.7,
    backgroundColor: '#3a3a3a',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

}); 