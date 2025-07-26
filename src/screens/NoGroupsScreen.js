import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { theme } from '../styles/theme';
import OptimizedImage from '../components/OptimizedImage';
import GroupModal from '../components/GroupModal';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const NoGroupsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const starScale = useRef(new Animated.Value(0.8)).current;
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupModalInitialContent, setGroupModalInitialContent] = useState('create');
  const [userProfileImageURL, setUserProfileImageURL] = useState(null);
  const [inviteCodeModalVisible, setInviteCodeModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

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
      Animated.spring(starScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Fetch user profile image
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfileImageURL(userData.profileImageURL || null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleJoinGroup = () => {
    setGroupModalInitialContent('join');
    setGroupModalVisible(true);
  };

  const handleCreateGroup = () => {
    setGroupModalInitialContent('create');
    setGroupModalVisible(true);
  };

  const handleGroupModalClose = () => {
    setGroupModalVisible(false);
  };

  const handleGroupCreated = async (groupId, groupName) => {
    try {
      console.log('🔍 Fetching group data for ID:', groupId);
      // Get the group's invite code
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        console.log('📋 Group data:', groupData);
        console.log('🔑 Invite code from data:', groupData.code);
        setInviteCode(groupData.code || 'NO_CODE_FOUND');
        setNewGroupName(groupName);
        setInviteCodeModalVisible(true);
      } else {
        console.log('❌ Group document does not exist');
        // Fallback: navigate to home screen
        navigation.replace('Main');
      }
    } catch (error) {
      console.error('Error fetching group invite code:', error);
      // Fallback: navigate to home screen
      navigation.replace('Main');
    }
  };

  const handleGroupJoined = (groupId) => {
    // For joining groups, just navigate to home screen
    navigation.replace('Main');
  };

  const handleShareInviteCode = async () => {
    try {
      await Share.share({
        message: `Join my FitCheck group "${newGroupName}"! Use invite code: ${inviteCode}`,
        title: 'Join my FitCheck group',
      });
    } catch (error) {
      console.error('Error sharing invite code:', error);
    }
  };

  const handleDismissInviteModal = () => {
    setInviteCodeModalVisible(false);
    navigation.replace('Main');
  };

  return (
    <View style={styles.container}>
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
        <Text style={styles.headerTitle}>Feed</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Settings')}
          >
            {userProfileImageURL ? (
              <OptimizedImage 
                source={{ uri: userProfileImageURL }} 
                style={styles.profileImage}
                showLoadingIndicator={false}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="person" size={24} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Main Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Star Logo */}
        <Animated.View
          style={[
            styles.starContainer,
            {
              transform: [{ scale: starScale }],
            },
          ]}
        >
          <OptimizedImage
            source={require('../../assets/starman-whitelegs.png')}
            style={styles.starLogo}
            contentFit="contain"
            showLoadingIndicator={false}
          />
        </Animated.View>

        {/* Welcome Text */}
        <Animated.View
          style={[
            styles.textSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.welcomeText}>Welcome to FitCheck!</Text>
          <Text style={styles.subtitleText}>
            To get started, join your crew or create your own.
          </Text>
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
            style={styles.joinButton}
            onPress={handleJoinGroup}
            activeOpacity={0.8}
          >
            <Text style={styles.joinButtonText}>Join Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateGroup}
            activeOpacity={0.8}
          >
            <Text style={styles.createButtonText}>Create Group</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
      <GroupModal
        visible={groupModalVisible}
        initialContent={groupModalInitialContent}
        onClose={handleGroupModalClose}
        onGroupCreated={handleGroupCreated}
        onGroupJoined={handleGroupJoined}
      />

      {/* Invite Code Modal */}
      <Modal
        visible={inviteCodeModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDismissInviteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Group Created!</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleDismissInviteModal}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={60} color="#CD9F3E" />
              </View>
              
              <Text style={styles.groupNameText}>{newGroupName}</Text>
              <Text style={styles.modalSubtitle}>
                Share this invite code with your friends:
              </Text>
              
              <View style={styles.inviteCodeContainer}>
                <Text style={styles.inviteCode}>{inviteCode}</Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => {
                    // Copy to clipboard functionality would go here
                    Alert.alert('Copied!', 'Invite code copied to clipboard');
                  }}
                >
                  <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShareInviteCode}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>Share Invite Code</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismissInviteModal}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissButtonText}>Continue to App</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePlaceholderText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  starContainer: {
    marginBottom: 40,
  },
  starLogo: {
    width: 200,
    height: 200,
  },
  textSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitleText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonSection: {
    width: '100%',
    flexDirection: 'row',
    gap: 16,
  },
  joinButton: {
    flex: 1,
    backgroundColor: '#B5483D',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B5483D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#B5483D',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B5483D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  groupNameText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#CD9F3E',
  },
  inviteCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#CD9F3E',
    letterSpacing: 2,
    marginRight: 12,
  },
  copyButton: {
    padding: 8,
    backgroundColor: '#CD9F3E',
    borderRadius: 8,
  },
  modalFooter: {
    gap: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B5483D',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#666666',
  },
  dismissButtonText: {
    color: '#CCCCCC',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default NoGroupsScreen; 