import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, doc, updateDoc, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

export default function GroupModal({
  visible,
  initialContent = 'create', // 'create' or 'join'
  onClose,
  onGroupCreated, // callback(groupId, groupName)
  onGroupJoined,  // callback(groupId)
}) {
  const { user } = useAuth();
  const [modalContent, setModalContent] = useState(initialContent);
  const [groupName, setGroupName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const contentSlideAnim = useRef(new Animated.Value(0)).current;
  const contentOpacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setModalContent(initialContent);
    setGroupName('');
    setGroupCode('');
    contentSlideAnim.setValue(0);
    contentOpacityAnim.setValue(1);
  }, [visible, initialContent]);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    setLoading(true);
    try {
      const groupCodeVal = Math.random().toString(36).substring(2, 8).toUpperCase();
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        description: '',
        code: groupCodeVal,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: new Date(),
        memberCount: 1,
      });
      setGroupName('');
      setLoading(false);
      onClose && onClose();
      onGroupCreated && onGroupCreated(groupRef.id, groupName.trim());
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', error.message);
    }
  };

  const handleJoinGroup = async () => {
    if (!groupCode.trim()) {
      Alert.alert('Error', 'Please enter a group code');
      return;
    }
    setLoading(true);
    try {
      const groupsQuery = query(
        collection(db, 'groups'),
        where('code', '==', groupCode.toUpperCase())
      );
      const snapshot = await getDocs(groupsQuery);
      if (snapshot.empty) {
        setLoading(false);
        Alert.alert('Error', 'Group not found');
        return;
      }
      const groupDoc = snapshot.docs[0];
      const groupData = groupDoc.data();
      if (groupData.members.includes(user.uid)) {
        setLoading(false);
        Alert.alert('Info', 'You are already in this group');
        return;
      }
      if (groupData.members.length >= 20) {
        setLoading(false);
        Alert.alert('Error', 'Group is full (max 20 members)');
        return;
      }
      await updateDoc(doc(db, 'groups', groupDoc.id), {
        members: arrayUnion(user.uid),
        memberCount: groupData.members.length + 1,
      });
      setGroupCode('');
      setLoading(false);
      onClose && onClose();
      onGroupJoined && onGroupJoined(groupDoc.id);
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', error.message);
    }
  };

  const switchToJoinModal = () => {
    Animated.parallel([
      Animated.timing(contentOpacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(contentSlideAnim, {
        toValue: -20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalContent('join');
      contentSlideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(contentOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentSlideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const switchToCreateModal = () => {
    Animated.parallel([
      Animated.timing(contentOpacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(contentSlideAnim, {
        toValue: 20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalContent('create');
      contentSlideAnim.setValue(-20);
      Animated.parallel([
        Animated.timing(contentOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentSlideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const closeModal = () => {
    onClose && onClose();
    setGroupName('');
    setGroupCode('');
    setModalContent(initialContent);
    contentSlideAnim.setValue(0);
    contentOpacityAnim.setValue(1);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={closeModal}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={closeModal}
      >
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={e => e.stopPropagation()}
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                opacity: contentOpacityAnim,
                transform: [{ translateX: contentSlideAnim }],
              },
            ]}
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeModal}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            {/* Create Group Content */}
            {modalContent === 'create' && (
              <>
                <Text style={styles.modalTitle}>Create a new group</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter group name"
                  placeholderTextColor="#8A8A8A"
                  value={groupName}
                  onChangeText={setGroupName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleCreateGroup}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalButtonText}>
                    {loading ? 'Creating...' : 'Create group'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.modalDivider} />
                <Text style={styles.modalSubtitle}>Have an invite?</Text>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={switchToJoinModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalButtonText}>Join a group</Text>
                </TouchableOpacity>
              </>
            )}
            {/* Join Group Content */}
            {modalContent === 'join' && (
              <>
                <View style={styles.joinModalHeader}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={switchToCreateModal}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.backButtonText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Join a Group</Text>
                  <View style={styles.placeholderButton} />
                </View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter code"
                  placeholderTextColor="#8A8A8A"
                  value={groupCode}
                  onChangeText={setGroupCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleJoinGroup}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalButtonText}>
                    {loading ? 'Joining...' : 'Join Group'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    marginHorizontal: 24,
    maxWidth: 320,
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  joinModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  placeholderButton: {
    width: 32,
    height: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInput: {
    backgroundColor: '#4A4A4A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButton: {
    backgroundColor: '#C44D4D',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalDivider: {
    height: 24,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
}); 