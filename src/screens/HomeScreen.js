import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, StatusBar, Modal, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import FitCard from '../components/FitCard';
import { theme } from '../styles/theme';

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

  useEffect(() => {
    fetchUserGroups();
  }, []);

  useEffect(() => {
    if (userGroups.length > 0) {
      fetchTodaysFits();
    }
  }, [userGroups]);

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
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
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
    <LinearGradient
      colors={[theme.colors.background, theme.colors.surface]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.filterSelector}
            onPress={() => setShowGroupFilter(true)}
          >
            <LinearGradient
              colors={theme.colors.primaryGradient}
              style={styles.filterSelectorGradient}
            >
              <Text style={styles.filterIcon}>{getFilterModeIcon()}</Text>
              <Text style={styles.filterText}>
                {getFilterModeText()}
              </Text>
              <Text style={styles.filterArrow}>▼</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>👋</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Today's Fits</Text>
          <Text style={styles.subtitle}>
            {stats.totalFits} fit{stats.totalFits !== 1 ? 's' : ''} • {stats.groupsWithFits} group{stats.groupsWithFits !== 1 ? 's' : ''} • {stats.totalRatings} ratings
          </Text>
        </View>
      </View>
      
      {/* Content */}
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
          >
            <LinearGradient
              colors={theme.colors.primaryGradient}
              style={styles.joinGroupGradient}
            >
              <Text style={styles.joinGroupText}>Create or Join Group</Text>
            </LinearGradient>
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header styles
  header: {
    paddingTop: 60,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  filterSelector: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  filterSelectorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  filterIcon: {
    fontSize: 20,
    marginRight: theme.spacing.xs,
  },
  filterText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    marginRight: theme.spacing.xs,
    letterSpacing: 0.3,
  },
  filterArrow: {
    ...theme.typography.caption,
    color: theme.colors.text,
    opacity: 0.8,
  },
  signOutButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...theme.shadows.sm,
  },
  signOutText: {
    fontSize: 22,
  },
  titleContainer: {
    alignItems: 'flex-start',
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    letterSpacing: 0.2,
  },
  
  // Content styles
  feedContainer: {
    paddingBottom: theme.spacing.lg,
  },
  
  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...theme.shadows.md,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyText: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  joinGroupButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  joinGroupGradient: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  joinGroupText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  


  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    width: '90%',
    maxHeight: '70%',
    ...theme.shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    padding: theme.spacing.xs,
  },
  modalCloseText: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  filterOptions: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  filterOptionSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  filterOptionIcon: {
    fontSize: 24,
    marginRight: theme.spacing.sm,
  },
  filterOptionText: {
    flex: 1,
  },
  filterOptionTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterOptionSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
});