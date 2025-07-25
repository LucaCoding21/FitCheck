import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

const CustomTagModal = ({ visible, onClose, onTagAdded, onTagDeleted }) => {
  const { user } = useAuth();
  const [tagText, setTagText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userCustomTags, setUserCustomTags] = useState([]);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const MAX_TAG_LENGTH = 15;

  useEffect(() => {
    if (visible) {
      animateIn();
      fetchUserCustomTags();
    } else {
      // Reset form when modal closes
      setTagText('');
      setLoading(false);
    }
  }, [visible]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
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

  const fetchUserCustomTags = async () => {
    try {
      if (!user?.uid) return;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserCustomTags(userData.customTags || []);
      }
    } catch (error) {
      console.error('Error fetching user custom tags:', error);
    }
  };

  const validateTag = (tag) => {
    if (!tag.trim()) {
      Alert.alert('Invalid Tag', 'Tag cannot be empty');
      return false;
    }
    
    if (tag.length > MAX_TAG_LENGTH) {
      Alert.alert('Tag Too Long', `Tag must be ${MAX_TAG_LENGTH} characters or less`);
      return false;
    }
    
    // Check for invalid characters - allow letters, numbers, and spaces
    const invalidChars = /[^a-zA-Z0-9\s]/;
    if (invalidChars.test(tag)) {
      Alert.alert('Invalid Characters', 'Tag can only contain letters, numbers, and spaces');
      return false;
    }
    
    // Check if tag already exists (case insensitive)
    const existingTags = userCustomTags.map(t => t.toLowerCase());
    if (existingTags.includes(tag.toLowerCase())) {
      Alert.alert('Tag Already Exists', 'You already have a tag with this name');
      return false;
    }
    
    return true;
  };

  const handleAddTag = async () => {
    const trimmedTag = tagText.trim();
    
    if (!validateTag(trimmedTag)) {
      return;
    }

    try {
      setLoading(true);
      
      if (!user?.uid) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Save to user's profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        customTags: arrayUnion(trimmedTag)
      });

      // Update local state
      setUserCustomTags(prev => [...prev, trimmedTag]);
      
      // Call parent callback
      onTagAdded(trimmedTag);
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error('Error adding custom tag:', error);
      Alert.alert('Error', 'Failed to add tag. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tagToDelete) => {
    try {
      if (!user?.uid) return;
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        customTags: arrayRemove(tagToDelete)
      });
      
      // Update local state
      setUserCustomTags(prev => prev.filter(tag => tag !== tagToDelete));
      
      // Notify parent component about the deletion
      if (onTagDeleted) {
        onTagDeleted(tagToDelete);
      }
      
    } catch (error) {
      console.error('Error deleting tag:', error);
      Alert.alert('Error', 'Failed to delete tag. Please try again.');
    }
  };

  const handleScreenTap = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleClose = () => {
    if (loading) return; // Prevent closing while loading
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0, 0, 0, 0.5)" />
      
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          {/* Prevent backdrop touch from closing modal and handle keyboard dismissal */}
          <TouchableWithoutFeedback onPress={handleScreenTap}>
            <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Add Custom Tag</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Input Section */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>Tag Name</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.hashtag}>#</Text>
                <TextInput
                  style={styles.textInput}
                  value={tagText}
                  onChangeText={setTagText}
                  placeholder="Enter tag name"
                  placeholderTextColor="#71717A"
                  maxLength={MAX_TAG_LENGTH}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={true}
                  editable={!loading}
                />
              </View>
              <Text style={styles.characterCount}>
                {tagText.length}/{MAX_TAG_LENGTH}
              </Text>
            </View>

            {/* Your Custom Tags Section */}
            {userCustomTags.length > 0 && (
              <View style={styles.customTagsSection}>
                <Text style={styles.sectionTitle}>Your Custom Tags</Text>
                <View style={styles.tagsContainer}>
                  {userCustomTags.map((tag, index) => (
                    <View key={index} style={styles.existingTag}>
                      <Text style={styles.existingTagText}>#{tag}</Text>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteTag(tag)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle" size={16} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.button, 
                  styles.addButton,
                  (!tagText.trim() || loading) && styles.addButtonDisabled
                ]}
                onPress={handleAddTag}
                disabled={!tagText.trim() || loading}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.addButtonText,
                  (!tagText.trim() || loading) && styles.addButtonTextDisabled
                ]}>
                  {loading ? 'Adding...' : 'Add Tag'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
            </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100, // Move modal up by 100px from center
  },
  modalContainer: {
    width: width - 40,
    maxWidth: 400,
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContent: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#3A3A3A',
  },
  inputSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  hashtag: {
    fontSize: 16,
    color: '#B5483D',
    fontWeight: '600',
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    padding: 0,
  },
  characterCount: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'right',
    marginTop: 8,
  },
  customTagsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  existingTag: {
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    marginLeft: 8,
    padding: 2,
  },
  existingTagText: {
    fontSize: 12,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#3A3A3A',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#B5483D',
  },
  addButtonDisabled: {
    backgroundColor: '#3A3A3A',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextDisabled: {
    color: '#71717A',
  },
});

export default CustomTagModal; 