import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, StatusBar, Modal, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import FitCard from '../components/FitCard';
import { theme } from '../styles/theme';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation, route }) {
  const { user } = useAuth();
  const [fits, setFits] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(route?.params?.selectedGroup || null);
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'group', 'fair'
  const [stats, setStats] = useState({
    totalFits: 0,
    totalRatings: 0,
    averageFairRating: 0,
    groupsWithFits: 0
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;

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
      Animated.spring(titleScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    fetchUserGroups();
  }, []);

  useEffect(() => {
    if (userGroups.length > 0) {
      fetchTodaysFits();
    }
  }, [userGroups]);

  // Set filter mode to 'group' when a specific group is selected
  useEffect(() => {
    if (selectedGroup && userGroups.length > 0) {
      setFilterMode('group');
    }
  }, [selectedGroup, userGroups]);

  const fetchUserGroups = async () => {
    try {
      const groupsQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(groupsQuery);
      const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserGroups(groups);
      
      if (groups.length > 0 && !selectedGroup) {
        setSelectedGroup(groups[0].id);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchTodaysFits = async () => {
    if (userGroups.length === 0) return;

    try {
      // Get all group IDs the user belongs to
      const userGroupIds = userGroups.map(group => group.id);
      
      // Fetch fits that have any of the user's group IDs in their groupIds array
      const fitsQuery = query(
        collection(db, 'fits'),
        where('groupIds', 'array-contains-any', userGroupIds)
      );
      
      const unsubscribe = onSnapshot(fitsQuery, (snapshot) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let fitsData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(fit => {
            // Filter for today's fits on the client side
            const fitDate = fit.createdAt?.toDate();
            return fitDate && fitDate >= today;
          })
          .sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()); // Sort by newest first

        // Apply group filter if needed
        if (filterMode === 'group' && selectedGroup) {
          fitsData = fitsData.filter(fit => 
            fit.groupIds && fit.groupIds.includes(selectedGroup)
          );
        }

        // Sort by fair rating if in fair mode
        if (filterMode === 'fair') {
          fitsData.sort((a, b) => (b.fairRating || 0) - (a.fairRating || 0));
        }
        
        setFits(fitsData);
        calculateStats(fitsData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching fits:', error);
    }
  };

  const calculateStats = (fitsData) => {
    const totalFits = fitsData.length;
    const totalRatings = fitsData.reduce((sum, fit) => sum + (fit.ratingCount || 0), 0);
    const averageFairRating = fitsData.length > 0 
      ? fitsData.reduce((sum, fit) => sum + (fit.fairRating || 0), 0) / fitsData.length 
      : 0;
    const groupsWithFits = new Set(fitsData.flatMap(fit => fit.groupIds || [])).size;

    setStats({
      totalFits,
      totalRatings,
      averageFairRating,
      groupsWithFits
    });
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              // Navigate back to onboarding screen after successful sign out
              navigation.replace('Onboarding');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const currentGroup = userGroups.find(g => g.id === selectedGroup);

  const getFilterModeText = () => {
    switch (filterMode) {
      case 'all': return 'All Groups';
      case 'group': return currentGroup?.name || 'Select Group';
      case 'fair': return 'Top Rated';
      default: return 'All Groups';
    }
  };

  const getFilterModeIcon = () => {
    switch (filterMode) {
      case 'all': return '👥';
      case 'group': return '🎯';
      case 'fair': return '⭐';
      default: return '👥';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* Enhanced Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.filterSelector}
            onPress={() => setShowGroupFilter(true)}
            activeOpacity={0.8}
          >
            <View style={styles.filterSelectorContainer}>
              <Text style={styles.filterIcon}>{getFilterModeIcon()}</Text>
              <Text style={styles.filterText}>
                {getFilterModeText()}
              </Text>
              <Text style={styles.filterArrow}>▼</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton} activeOpacity={0.8}>
            <Text style={styles.signOutText}>👋</Text>
          </TouchableOpacity>
        </View>
        
        <Animated.View 
          style={[
            styles.titleContainer,
            {
              transform: [{ scale: titleScale }],
            },
          ]}
        >
          <Text style={styles.title}>Today's Fits</Text>
          <Text style={styles.subtitle}>
            {stats.totalFits} fit{stats.totalFits !== 1 ? 's' : ''} • {stats.groupsWithFits} group{stats.groupsWithFits !== 1 ? 's' : ''} • {stats.totalRatings} ratings
          </Text>
        </Animated.View>
      </Animated.View>
      
      {/* Content */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {userGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>👥</Text>
            </View>
            <Text style={styles.emptyText}>Join a group to get started</Text>
            <Text style={styles.emptySubtext}>
              Connect with friends and start rating fits together
            </Text>
            <TouchableOpacity 
              style={styles.joinGroupButton}
              onPress={() => navigation.navigate('Groups')}
              activeOpacity={0.8}
            >
              <View style={styles.joinGroupContainer}>
                <Text style={styles.joinGroupText}>Create or Join Group</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : fits.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>📸</Text>
            </View>
            <Text style={styles.emptyText}>No fits posted today</Text>
            <Text style={styles.emptySubtext}>
              Be the first to drop your fit in any of your groups
            </Text>
          </View>
        ) : (
          <FlatList
            data={fits}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <FitCard fit={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.feedContainer}
          />
        )}
      </Animated.View>

      {/* Group Filter Modal */}
      <Modal
        visible={showGroupFilter}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGroupFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Feed</Text>
              <TouchableOpacity 
                onPress={() => setShowGroupFilter(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filterMode === 'all' && styles.filterOptionSelected
                ]}
                onPress={() => {
                  setFilterMode('all');
                  setShowGroupFilter(false);
                }}
              >
                <Text style={styles.filterOptionIcon}>👥</Text>
                <View style={styles.filterOptionText}>
                  <Text style={styles.filterOptionTitle}>All Groups</Text>
                  <Text style={styles.filterOptionSubtitle}>See fits from all your groups</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filterMode === 'fair' && styles.filterOptionSelected
                ]}
                onPress={() => {
                  setFilterMode('fair');
                  setShowGroupFilter(false);
                }}
              >
                <Text style={styles.filterOptionIcon}>⭐</Text>
                <View style={styles.filterOptionText}>
                  <Text style={styles.filterOptionTitle}>Top Rated</Text>
                  <Text style={styles.filterOptionSubtitle}>See highest rated fits first</Text>
                </View>
              </TouchableOpacity>

              {userGroups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.filterOption,
                    filterMode === 'group' && selectedGroup === group.id && styles.filterOptionSelected
                  ]}
                  onPress={() => {
                    setFilterMode('group');
                    setSelectedGroup(group.id);
                    setShowGroupFilter(false);
                  }}
                >
                  <Text style={styles.filterOptionIcon}>🎯</Text>
                  <View style={styles.filterOptionText}>
                    <Text style={styles.filterOptionTitle}>{group.name}</Text>
                    <Text style={styles.filterOptionSubtitle}>{group.memberCount} members</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  
  // Header styles
  header: {
    paddingTop: 60,
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },

  filterSelector: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  filterSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
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
  filterIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  filterText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginRight: 8,
    letterSpacing: 0.3,
  },
  filterArrow: {
    fontSize: 14,
    color: '#71717A',
  },
  signOutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  signOutText: {
    fontSize: 22,
  },
  titleContainer: {
    alignItems: 'flex-start',
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#71717A',
    letterSpacing: 0.2,
  },
  
  // Content styles
  contentContainer: {
    flex: 1,
  },
  feedContainer: {
    paddingBottom: 24,
  },
  
  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  joinGroupButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#B5483D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  joinGroupContainer: {
    backgroundColor: '#B5483D',
    paddingHorizontal: 32,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinGroupText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  


  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    width: '90%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#71717A',
  },
  filterOptions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  filterOptionSelected: {
    backgroundColor: 'rgba(181, 72, 61, 0.2)',
    borderWidth: 1,
    borderColor: '#B5483D',
  },
  filterOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  filterOptionText: {
    flex: 1,
  },
  filterOptionTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  filterOptionSubtitle: {
    fontSize: 14,
    color: '#71717A',
    marginTop: 4,
  },
});