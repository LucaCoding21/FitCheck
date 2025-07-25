import React, { useState, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import { theme } from '../styles/theme';
import * as Clipboard from 'expo-clipboard';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';

// Custom Toast config
const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: theme.colors.surface,
        borderLeftColor: 'transparent', // Ensure no left accent
        borderRadius: theme.borderRadius.md,
        minHeight: 48,
        alignItems: 'center',
        shadowOpacity: 0,
        marginHorizontal: 16,
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
      }}
      text2Style={{ color: theme.colors.textSecondary }}
      renderLeadingIcon={() => (
        <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} style={{ marginRight: 8 }} />
      )}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        backgroundColor: theme.colors.surface,
        borderLeftColor: 'transparent', // Ensure no left accent
        borderRadius: theme.borderRadius.md,
        minHeight: 48,
        alignItems: 'center',
        shadowOpacity: 0,
        marginHorizontal: 16,
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
      }}
      text2Style={{ color: theme.colors.textSecondary }}
      renderLeadingIcon={() => (
        <Ionicons name="close-circle" size={22} color={theme.colors.error} style={{ marginRight: 8 }} />
      )}
    />
  ),
};

export default function GroupDetailsScreen({ navigation, route }) {
  const { user } = useAuth();
  if (!user) {
    // Show loading while auth is being checked
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#B5483D" />
      </View>
    );
  }
  const { groupId, groupName } = route.params;
  
  const [groupImage, setGroupImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [groupData, setGroupData] = useState(null);
  const [hasPostedToday, setHasPostedToday] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(groupName);
  const [editingGroupImage, setEditingGroupImage] = useState(null);
  
  // Custom modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    onConfirm: null,
    isDestructive: false,
  });
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const imageScale = useRef(new Animated.Value(0.8)).current;
  const menuScale = useRef(new Animated.Value(0.8)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchUserData();
    fetchGroupData();
    checkIfPostedToday();
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

  // Fetch group members only after groupData is loaded
  useEffect(() => {
    if (groupData && groupData.members && groupData.members.length > 0) {
      fetchGroupMembers();
    }
  }, [groupData]);

  // Refresh data when screen comes into focus (e.g., after posting a fit)
  useFocusEffect(
    React.useCallback(() => {
      if (groupData && groupData.members && groupData.members.length > 0) {
        fetchGroupMembers();
        checkIfPostedToday();
      }
    }, [groupData])
  );

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

  // Check if the current user posted today in this group
  const checkIfPostedToday = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fitsQuery = query(
        collection(db, 'fits'),
        where('groupIds', 'array-contains', groupId),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(fitsQuery);
      const fits = snapshot.docs.map(doc => doc.data());
      const postedToday = fits.some(fit => {
        const fitDate = fit.createdAt?.toDate ? fit.createdAt.toDate() : new Date(fit.createdAt);
        return fitDate >= today && fitDate < tomorrow;
      });
      setHasPostedToday(postedToday);
    } catch (error) {
      setHasPostedToday(false);
    }
  };

  // Fetch all group members' user data and their posted status
  const fetchGroupMembers = async () => {
    try {
      if (!groupData || !groupData.members || groupData.members.length === 0) {
        setGroupMembers([]);
        return;
      }
      
      // Get today's date range for checking posted status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Firestore 'getDoc' for each memberId (document ID is UID)
      const memberIds = groupData.members;
      const memberPromises = memberIds.map(async (uid) => {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const userData = { uid: userDoc.id, ...userDoc.data() };
          
          // Check if this member posted today by querying fits collection
          const fitsQuery = query(
            collection(db, 'fits'),
            where('groupIds', 'array-contains', groupId),
            where('userId', '==', uid)
          );
          const fitsSnapshot = await getDocs(fitsQuery);
          const fits = fitsSnapshot.docs.map(doc => doc.data());
          const postedToday = fits.some(fit => {
            const fitDate = fit.createdAt?.toDate ? fit.createdAt.toDate() : new Date(fit.createdAt);
            return fitDate >= today && fitDate < tomorrow;
          });
          
          return { ...userData, postedToday };
        }
        return null;
      });
      
      let members = (await Promise.all(memberPromises)).filter(Boolean);
      // Sort: current user first, then by username
      members.sort((a, b) => {
        if (a.uid === user.uid) return -1;
        if (b.uid === user.uid) return 1;
        return (a.username || '').localeCompare(b.username || '');
      });
      setGroupMembers(members);
    } catch (error) {
      console.error('Error fetching group members:', error);
      setGroupMembers([]);
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
        if (isEditMode) {
          setEditingGroupImage(result.assets[0].uri);
        } else {
          setGroupImage(result.assets[0].uri);
        }
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

      // Navigate back to Groups screen
      navigation.goBack();
    } catch (error) {
      console.error('Error updating group:', error);
      Alert.alert('Error', 'Failed to update group. Please try again.');
    }
    setLoading(false);
  };

  const openMenu = () => {
    setMenuVisible(true);
    Animated.parallel([
      Animated.timing(menuOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(menuScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(menuScale, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
    });
  };

  const openConfirmModal = (config) => {
    setConfirmModalConfig(config);
    setShowConfirmModal(true);
  };

  const hideConfirmModal = () => {
    setShowConfirmModal(false);
  };

  const handleEditGroup = () => {
    closeMenu();
    setIsEditMode(true);
    setEditingGroupName(groupData?.name || groupName);
    setEditingGroupImage(null); // Clear editing image to show placeholder
  };

  const handleSaveGroup = async () => {
    if (!editingGroupName.trim()) {
      openConfirmModal({
        title: 'Error',
        message: 'Group name cannot be empty.',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => hideConfirmModal(),
        isDestructive: false,
      });
      return;
    }

    openConfirmModal({
      title: 'Save Changes',
      message: 'Are you sure you want to save these changes?',
      confirmText: 'Save',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          setLoading(true);
          hideConfirmModal();
          
          let newGroupImageURL = groupData?.groupImageURL || null;
          
          // Upload new image if selected
          if (editingGroupImage) {
            try {
              newGroupImageURL = await uploadImageToFirebase(editingGroupImage);
            } catch (uploadError) {
              console.error('Image upload failed:', uploadError);
              openConfirmModal({
                title: 'Image Upload Failed',
                message: 'Your group will be updated without the new image.',
                confirmText: 'OK',
                cancelText: '',
                onConfirm: () => hideConfirmModal(),
                isDestructive: false,
              });
            }
          }

          // Update group document
          await updateDoc(doc(db, 'groups', groupId), {
            name: editingGroupName.trim(),
            groupImageURL: newGroupImageURL,
            updatedAt: new Date(),
          });

          // Update local state
          setGroupData(prev => ({
            ...prev,
            name: editingGroupName.trim(),
            groupImageURL: newGroupImageURL,
          }));
          setGroupImage(newGroupImageURL);
          
          // Exit edit mode
          setIsEditMode(false);
          setEditingGroupImage(null);
          
          Toast.show({
            type: 'success',
            text1: 'Group updated successfully',
            position: 'bottom',
            visibilityTime: 2000,
            autoHide: true,
            bottomOffset: 60,
          });
          
        } catch (error) {
          console.error('Error updating group:', error);
          openConfirmModal({
            title: 'Error',
            message: 'Failed to update group. Please try again.',
            confirmText: 'OK',
            cancelText: '',
            onConfirm: () => hideConfirmModal(),
            isDestructive: false,
          });
        } finally {
          setLoading(false);
        }
      },
      isDestructive: false,
    });
  };

  const handleCancelEdit = () => {
    openConfirmModal({
      title: 'Cancel Editing',
      message: 'Are you sure you want to cancel? Your changes will be lost.',
      confirmText: 'Cancel',
      cancelText: 'Keep Editing',
      onConfirm: () => {
        hideConfirmModal();
        setIsEditMode(false);
        setEditingGroupName(groupData?.name || groupName);
        setEditingGroupImage(null);
      },
      isDestructive: true,
    });
  };

  const handleLeaveGroup = async () => {
    closeMenu();
    openConfirmModal({
      title: 'Leave Group',
      message: `Are you sure you want to leave "${groupName}"? You won't be able to see the group's fits anymore.`,
      confirmText: 'Leave Group',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          setLoading(true);
          hideConfirmModal();
          
          // Remove user from group's members array
          await updateDoc(doc(db, 'groups', groupId), {
            members: arrayRemove(user.uid),
            memberCount: groupData?.memberCount - 1,
          });

          // Remove group from user's groups array
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const updatedGroups = userData.groups?.filter(g => g !== groupId) || [];
            await updateDoc(doc(db, 'users', user.uid), {
              groups: updatedGroups,
            });
          }

          // Navigate back to Groups screen
          navigation.goBack();
          
        } catch (error) {
          console.error('Error leaving group:', error);
          openConfirmModal({
            title: 'Error',
            message: 'Failed to leave group. Please try again.',
            confirmText: 'OK',
            cancelText: '',
            onConfirm: () => hideConfirmModal(),
            isDestructive: false,
          });
        } finally {
          setLoading(false);
        }
      },
      isDestructive: true,
    });
  };

  return (
    <>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <View style={styles.container}>
          {menuVisible && (
            <TouchableOpacity
              style={styles.menuBackdrop}
              activeOpacity={1}
              onPress={closeMenu}
            />
          )}
        
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
            onPress={isEditMode ? handleCancelEdit : () => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name={isEditMode ? "close" : "chevron-back"} size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            {isEditMode ? (
              <View style={styles.editableTitleContainer}>
                <TextInput
                  style={styles.editableTitle}
                  value={editingGroupName}
                  onChangeText={setEditingGroupName}
                  placeholder="Enter group name"
                  placeholderTextColor={theme.colors.textMuted}
                  maxLength={30}
                />
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setEditingGroupName('')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={28} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.headerTitle}>{groupData?.name || groupName}</Text>
            )}
            {/* Streak Badge */}
            {groupData?.streak > 0 && (
              <View style={styles.streakBadge}>
                <Ionicons name="flame" size={14} color="#FF6B35" />
                <Text style={styles.streakCount}>{groupData.streak} day streak</Text>
              </View>
            )}
          </View>
          {isEditMode ? (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveGroup}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={menuVisible ? closeMenu : openMenu}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Group Info Section */}
        <Animated.View
          style={[
            styles.groupInfoSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Group Profile Picture */}
          <View style={styles.groupImageContainer}>
            {(isEditMode ? editingGroupImage : groupImage) ? (
              <OptimizedImage source={{ uri: isEditMode ? editingGroupImage : groupImage }} style={styles.groupImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderText}>
                  {isEditMode ? 'tap to add photo' : 'add photo'}
                </Text>
              </View>
            )}
            
            {/* Change cover photo overlay in edit mode */}
            {isEditMode && (
              <TouchableOpacity
                style={styles.changePhotoOverlay}
                onPress={pickImage}
                activeOpacity={0.8}
              >
                <View style={styles.changePhotoButton}>
                  <Ionicons name="camera" size={16} color={theme.colors.text} />
                  <Text style={styles.changePhotoText}>Change cover photo</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Group Code */}
          {groupData?.code && (
            <View style={styles.groupCodeContainer}>
              <Text style={styles.groupCodeText}>code: {groupData.code}</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={async () => {
                  await Clipboard.setStringAsync(groupData.code);
                  Toast.show({
                    type: 'success',
                    text1: 'Copied to clipboard',
                    position: 'bottom',
                    visibilityTime: 1200,
                    autoHide: true,
                    bottomOffset: 60,
                  });
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
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
          <Text style={styles.membersTitle}>{groupData?.memberCount || 1} Member{groupData?.memberCount !== 1 ? 's' : ''}</Text>
          <ScrollView 
            style={styles.membersScrollView} 
            contentContainerStyle={{ paddingBottom: 32 }} 
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {groupMembers.map(member => {
              // Use the postedToday property that was fetched with member data
              const postedToday = member.postedToday || false;
              return (
                <View style={styles.memberItem} key={member.uid}>
                  <View style={styles.memberAvatar}>
                    {member.profileImageURL ? (
                      <OptimizedImage
                        source={{ uri: member.profileImageURL }}
                        style={styles.memberImage}
                        showLoadingIndicator={false}
                      />
                    ) : (
                      <Text style={styles.memberAvatarText}>
                        {(member.username || member.email || 'U').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.username || member.email || 'User'}</Text>
                    {postedToday ? (
                      <Text style={styles.memberStatus}>Posted</Text>
                    ) : (
                      <Text style={styles.memberStatusNotPosted}>No post yet</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Menu Modal */}
        {menuVisible && (
          <Animated.View
            style={[
              styles.menuOverlay,
              {
                opacity: menuOpacity,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.menuContainer}
              activeOpacity={1}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleEditGroup}
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemText}>Edit group</Text>
                <Ionicons name="pencil" size={16} color={theme.colors.text} style={styles.menuIcon} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleLeaveGroup}
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemTextDanger}>Leave Group</Text>
                <Ionicons name="log-out-outline" size={16} color={theme.colors.error} style={styles.menuIcon} />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        )}
        </View>

        {/* Custom Confirmation Modal */}
        {showConfirmModal && (
          <Modal
            visible={showConfirmModal}
            transparent={true}
            animationType="fade"
            onRequestClose={hideConfirmModal}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={hideConfirmModal}
            >
              <TouchableOpacity
                style={styles.modalContainer}
                activeOpacity={1}
                onPress={() => {}}
              >
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>{confirmModalConfig.title}</Text>
                  <Text style={styles.modalMessage}>{confirmModalConfig.message}</Text>
                  
                  <View style={styles.modalButtons}>
                    {confirmModalConfig.cancelText && (
                      <TouchableOpacity
                        style={styles.modalButtonSecondary}
                        onPress={hideConfirmModal}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.modalButtonSecondaryText}>
                          {confirmModalConfig.cancelText}
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                      style={[
                        styles.modalButtonPrimary,
                        confirmModalConfig.isDestructive && styles.modalButtonDestructive
                      ]}
                      onPress={confirmModalConfig.onConfirm}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.modalButtonPrimaryText,
                        confirmModalConfig.isDestructive && styles.modalButtonDestructiveText
                      ]}>
                        {confirmModalConfig.confirmText}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

      </SafeAreaView>
      <Toast config={toastConfig} />
    </>
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  editableTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
    minWidth: 200,
  },
  editableTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
    textAlign: 'center',
    minWidth: 200,
  },
  clearButton: {
    position: 'absolute',
    right: -10,
    padding: 8,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    minWidth: 70,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  streakCount: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: '600',
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfoSection: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  groupImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
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
  groupCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  groupCodeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.colors.textMuted,
    marginRight: 8,
  },
  copyButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  membersSection: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  membersScrollView: {
    flex: 1,
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
    aspectRatio: 1,
    overflow: 'hidden',
  },
  memberImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    aspectRatio: 1,
    overflow: 'hidden',
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
  memberStatusNotPosted: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '500',
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
  },
  menuOverlay: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 1000,
  },
  menuContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 8,
    minWidth: 140,
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  menuItemTextDanger: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.error,
    flex: 1,
  },
  menuIcon: {
    marginLeft: 8,
  },
  changePhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  changePhotoText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Custom Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalContent: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  modalMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  modalButtonDestructive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.error,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  modalButtonDestructiveText: {
    color: theme.colors.error,
  },
}); 