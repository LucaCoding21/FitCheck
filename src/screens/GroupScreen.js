import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  StatusBar,
  Keyboard,
  Animated,
  Dimensions,
  SafeAreaView,
  Image,
  Modal,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from '../components/OptimizedImage';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  where,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";
import { useFocusEffect } from '@react-navigation/native';
import GroupModal from '../components/GroupModal';

const { width } = Dimensions.get('window');

export default function GroupScreen({ navigation }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [settingsMode, setSettingsMode] = useState(false);
  
  // Single modal state with content switching
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupModalInitialContent, setGroupModalInitialContent] = useState('create');

  useEffect(() => {
    fetchUserGroups();
    
    // Animate in
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
    ]).start();
    
    // Dismiss keyboard when component unmounts
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  // Refresh groups when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchUserGroups();
    }, [])
  );

  const fetchUserGroups = async () => {
    try {
      const groupsQuery = query(
        collection(db, "groups"),
        where("members", "array-contains", user.uid)
      );
      const snapshot = await getDocs(groupsQuery);
      const groups = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Fetch today's activity for each group
      const groupsWithActivity = await Promise.all(
        groups.map(async (group) => {
          const postedToday = await getUsersPostedToday(group.id);
          return {
            ...group,
            postedToday,
          };
        })
      );
      
      setUserGroups(groupsWithActivity);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const getUsersPostedToday = async (groupId) => {
    try {
      // Get today's date at midnight (local timezone)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get tomorrow's date at midnight (local timezone)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Query fits for this group posted today
      const fitsQuery = query(
        collection(db, "fits"),
        where("groupIds", "array-contains", groupId)
      );

      const snapshot = await getDocs(fitsQuery);
      const fits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter for today's fits and get unique user IDs
      const todayFits = fits.filter(fit => {
        const fitDate = fit.createdAt?.toDate();
        return fitDate && fitDate >= today && fitDate < tomorrow;
      });

      // Get unique user IDs who posted today
      const uniqueUserIds = new Set();
      todayFits.forEach(fit => {
        if (fit.userId) {
          uniqueUserIds.add(fit.userId);
        }
      });

      return uniqueUserIds.size;
    } catch (error) {
      console.error("Error getting users posted today:", error);
      return 0;
    }
  };

  const openCreateGroupModal = () => {
    setGroupModalInitialContent('create');
    setGroupModalVisible(true);
  };
  const openJoinGroupModal = () => {
    setGroupModalInitialContent('join');
    setGroupModalVisible(true);
  };
  const handleGroupModalClose = () => {
    setGroupModalVisible(false);
  };
  const handleGroupCreated = (groupId, groupName) => {
    navigation.navigate('GroupDetails', { groupId, groupName });
  };
  const handleGroupJoined = (groupId) => {
    navigation.replace('Main', { selectedGroup: groupId });
  };

  const handleLeaveGroup = async (groupId, groupName) => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${groupName}"? You won't be able to see the group's fits anymore.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave Group',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Remove user from group's members array
              await updateDoc(doc(db, 'groups', groupId), {
                members: arrayRemove(user.uid),
                memberCount: userGroups.find(g => g.id === groupId)?.memberCount - 1,
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

              // Refresh groups list
              await fetchUserGroups();
              
              // Exit settings mode
              setSettingsMode(false);
              
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('Error', 'Failed to leave group. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const toggleSettingsMode = () => {
    console.log('Toggle settings mode, current:', settingsMode);
    setSettingsMode(!settingsMode);
  };

  const renderGroupCard = ({ item, index }) => {
    const scaleAnim = new Animated.Value(1);
    
    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View
        style={[
          styles.groupCard,
          {
            transform: [{ scale: scaleAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.groupCardTouchable}
          onPress={() => !settingsMode && navigation.navigate("GroupDetails", { groupId: item.id, groupName: item.name })}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <View style={styles.groupAvatar}>
            {item.groupImageURL ? (
              <OptimizedImage
                source={{ uri: item.groupImageURL }}
                style={styles.groupAvatarImage}
                showLoadingIndicator={false}
              />
            ) : (
              <Text style={styles.groupAvatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupDetails}>
              {item.memberCount} members
            </Text>
          </View>
          <View style={styles.activityContainer}>
            {settingsMode ? (
              <TouchableOpacity
                style={styles.leaveButton}
                onPress={() => handleLeaveGroup(item.id, item.name)}
                activeOpacity={0.7}
              >
                <Ionicons name="exit-outline" size={20} color={theme.colors.error} />
                <Text style={styles.leaveButtonText}>Leave</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.activityText}>
                {item.postedToday || 0}/{item.memberCount} posted today
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const filteredGroups = userGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Groups</Text>
          <TouchableOpacity
            onPress={toggleSettingsMode}
            style={[styles.settingsButton, settingsMode && styles.settingsButtonActive]}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={settingsMode ? "checkmark" : "settings-outline"} 
              size={20} 
              color={settingsMode ? theme.colors.primary : theme.colors.text} 
            />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Groups"
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          <View style={styles.searchIcon}>
            <Ionicons name="search" size={16} color={theme.colors.textMuted} />
          </View>
        </View>

        {/* Groups List with New Group Button */}
        <FlatList
          data={filteredGroups}
          renderItem={renderGroupCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.groupsList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={() => (
            <TouchableOpacity
              style={styles.newGroupButton}
              onPress={openCreateGroupModal}
              activeOpacity={0.8}
            >
              <View style={styles.newGroupIcon}>
                <Ionicons name="add" size={16} color={theme.colors.text} />
              </View>
              <Text style={styles.newGroupText}>New Group</Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>

      {/* Single Modal with Animated Content */}
      <GroupModal
        visible={groupModalVisible}
        initialContent={groupModalInitialContent}
        onClose={handleGroupModalClose}
        onGroupCreated={handleGroupCreated}
        onGroupJoined={handleGroupJoined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingsButtonActive: {
    backgroundColor: 'rgba(196, 77, 77, 0.2)',
    borderColor: theme.colors.primary,
  },
  searchContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 40,
  },
  searchInput: {
    backgroundColor: '#363636',
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 10,

    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: 330,
    height: 37,
    alignSelf: 'center',
  },
  searchIcon: {
    position: 'absolute',
    right: 40,
    top: 8,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupsList: {
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  separator: {
    height: theme.spacing.sm,
  },
  groupCard: {
    backgroundColor: '#494949',
    borderRadius: theme.borderRadius.lg,
    
    marginBottom: 15,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: 371,
    height: 72,
    alignSelf: 'center',
    ...theme.shadows.sm,
  },
  groupCardTouchable: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    width: '100%',
    height: '100%',
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    aspectRatio: 1, // Ensure perfect circle
    overflow: 'hidden', // Crop image to circle
  },
  groupAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    aspectRatio: 1, // Ensure image is square
    overflow: 'hidden', // Crop image to circle
  },
  groupAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  groupDetails: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  activityContainer: {
    alignItems: 'flex-end',
  },
  activityText: {
    fontSize: 14,
    color: '#CD9F3E', // Golden-yellow color for activity
    fontWeight: "600",
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  leaveButtonText: {
    fontSize: 14,
    color: theme.colors.error,
    fontWeight: '600',
    marginLeft: 6,
  },
  newGroupButton: {
    backgroundColor: '#652721', // Exact color from design
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop:20,
    marginBottom: 120, // Space for bottom navigation
    alignSelf: 'center',
    width: 371,
    ...theme.shadows.md,
  },
  newGroupIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  newGroupText: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    marginHorizontal: 24,
    maxWidth: 320, // Much smaller max width
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
