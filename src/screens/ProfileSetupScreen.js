import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db, auth } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import KeyboardAwareContainer from '../components/KeyboardAwareContainer';
import OptimizedImage from '../components/OptimizedImage';

const { width, height } = Dimensions.get('window');

const ProfileSetupScreen = ({ navigation, route }) => {
  const { setJustSignedUp } = useAuth();
  const [username, setUsername] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const imageScale = useRef(new Animated.Value(0.8)).current;

  // Refs for input focus management
  const usernameInputRef = useRef(null);

  useEffect(() => {
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

  const handleInputFocus = () => {
    setFocusedInput(true);
  };

  const handleInputBlur = () => {
    setFocusedInput(false);
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to select a profile picture.');
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
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImageToFirebase = async (imageUri) => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');
      
      const imageRef = ref(storage, `profile-images/${userId}`);
      await uploadBytes(imageRef, blob);
      
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  const handleComplete = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    if (username.trim().length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long');
      return;
    }

    setLoading(true);
    
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      let profileImageURL = null;
      
      // Upload image if selected
      if (profileImage) {
        try {
          profileImageURL = await uploadImageToFirebase(profileImage);
        } catch (uploadError) {
          console.error('Image upload failed, continuing without image:', uploadError);
          // Continue without the image rather than failing the entire profile setup
          profileImageURL = null;
          Alert.alert(
            'Image Upload Failed', 
            'Your profile will be created without a profile picture. You can add one later.',
            [{ text: 'OK' }]
          );
        }
      }

      // Update user document in Firestore
      await updateDoc(doc(db, 'users', userId), {
        username: username.trim(),
        profileImageURL,
        profileCompleted: true,
        updatedAt: new Date(),
      });

      // Clear the justSignedUp flag
      setJustSignedUp(false);

      // Force a small delay to ensure state updates are processed
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error completing profile:', error);
      Alert.alert('Error', 'Failed to complete profile setup. Please try again.');
      setLoading(false);
    }
  };

  // Remove back button functionality - users must complete profile setup
  // const handleBack = () => {
  //   navigation.goBack();
  // };

  return (
    <KeyboardAwareContainer>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      <View style={styles.container}>
        {/* Header Section */}
        <Animated.View
          style={[
            styles.headerSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.title}>Create your Profile</Text>
        </Animated.View>

        {/* Profile Image Section */}
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
            style={styles.profileImageContainer}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {profileImage ? (
              <OptimizedImage source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderText}>add photo</Text>
              </View>
            )}
            <View style={styles.imageOverlay}>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Username Input Section */}
        <Animated.View
          style={[
            styles.inputSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[
            styles.inputContainer,
            focusedInput && styles.inputContainerFocused
          ]}>
            <Ionicons
              name="person-outline"
              size={20}
              color={focusedInput ? '#B5483D' : '#71717A'}
              style={styles.inputIcon}
            />
            <TextInput
              ref={usernameInputRef}
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#71717A"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              returnKeyType="done"
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onSubmitEditing={handleComplete}
              maxLength={20}
            />
          </View>
        </Animated.View>

        {/* Complete Button */}
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
              styles.completeButton,
              loading && styles.completeButtonDisabled
            ]}
            onPress={handleComplete}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.completeButtonText}>
              {loading ? 'Creating Profile...' : 'Complete'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAwareContainer>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 40,
  },
  headerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    zIndex: 1,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  imageSection: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 0,
  },
  profileImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  profileImage: {
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
  inputSection: {
    flex: 1,
    justifyContent: 'flex-start',
    marginTop: 25,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: '#B5483D',
    shadowColor: '#B5483D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  buttonSection: {
    paddingBottom: 40,
  },
  completeButton: {
    backgroundColor: '#B5483D',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B5483D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  completeButtonDisabled: {
    opacity: 0.7,
    backgroundColor: '#3a3a3a',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default ProfileSetupScreen; 