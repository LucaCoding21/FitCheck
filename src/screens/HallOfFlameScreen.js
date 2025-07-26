import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import { 
  getWinnerHistoryForGroup, 
  getWinnerArchiveForGroup,
  getWinnerStatsForGroup,
  getTopPerformersForGroup,
  getAllWinnerHistory
} from '../services/DailyWinnerService';
import { theme } from '../styles/theme';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import WinnerArchiveCard from '../components/WinnerArchiveCard';

const { width } = Dimensions.get('window');

export default function HallOfFlameScreen({ navigation, route }) {
  const { user } = useAuth();
  const selectedGroup = route?.params?.selectedGroup || 'all';
  const selectedGroupName = route?.params?.selectedGroupName || 'All';
  const winnerFitId = route?.params?.winnerFitId || null;
  const celebrationMode = route?.params?.celebrationMode || false;
  const userGroups = route?.params?.userGroups || [];

  const [winnerHistory, setWinnerHistory] = useState([]);
  const [celebratedFit, setCelebratedFit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [hasMoreWinners, setHasMoreWinners] = useState(true);
  const [archiveOffset, setArchiveOffset] = useState(0);
  const isMountedRef = useRef(true);
  const unsubscribeRef = useRef(null);

  // Memoize userGroups to prevent unnecessary re-renders
  const memoizedUserGroups = useRef(userGroups);
  if (JSON.stringify(memoizedUserGroups.current) !== JSON.stringify(userGroups)) {
    memoizedUserGroups.current = userGroups;
  }

  // Memoize the fetch functions to prevent recreation on every render
  const fetchCelebratedFit = useCallback(async () => {
    if (!winnerFitId) return;

    try {
      setLoading(true);
      
      // Clean up any existing listener
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      const fitRef = doc(db, 'fits', winnerFitId);
      
      const unsubscribe = onSnapshot(fitRef, (doc) => {
        if (doc.exists() && isMountedRef.current) {
          const fitData = { id: doc.id, ...doc.data() };
          setCelebratedFit(fitData);
        }
        if (isMountedRef.current) setLoading(false);
      }, (error) => {
        console.error('Error in onSnapshot:', error);
        if (isMountedRef.current) setLoading(false);
      });

      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('Error fetching celebrated fit:', error);
      if (isMountedRef.current) setLoading(false);
    }
  }, [winnerFitId]);

  const fetchArchive = useCallback(async (offset = 0, append = false) => {
    if (!user?.uid || !selectedGroup) return;

    try {
      setArchiveLoading(true);
      if (!append) {
        setLoading(true); // Set main loading state for initial fetch
      }
      
      let archive;
      if (selectedGroup === 'all') {
        // Use new "All" aggregation method
        archive = await getAllWinnerHistory(memoizedUserGroups.current, 20);
        // For "All" we don't support pagination yet, so we'll slice the results
        if (offset > 0) {
          archive = archive.slice(offset, offset + 20);
        } else {
          archive = archive.slice(0, 20);
        }
      } else {
        // Use new group-specific method
        archive = await getWinnerArchiveForGroup(selectedGroup, 20, offset);
      }
      
      if (isMountedRef.current) {
        if (append) {
          setWinnerHistory(prev => [...prev, ...archive]);
        } else {
          setWinnerHistory(archive);
        }
        setArchiveOffset(offset + archive.length);
        setHasMoreWinners(archive.length === 20);
      }
    } catch (error) {
      console.error('Error fetching archive:', error);
    } finally {
      if (isMountedRef.current) {
        setArchiveLoading(false);
        if (!append) {
          setLoading(false); // Clear main loading state for initial fetch
        }
      }
    }
  }, [user?.uid, selectedGroup]);

  const handleLoadMore = useCallback(() => {
    if (!archiveLoading && hasMoreWinners) {
      fetchArchive(archiveOffset, true);
    }
  }, [archiveLoading, hasMoreWinners, archiveOffset, fetchArchive]);

  const handleWinnerPress = useCallback((winner) => {
    if (winner?.winner?.fitId) {
      navigation.navigate('HallOfFlame', {
        selectedGroup,
        winnerFitId: winner.winner.fitId,
        celebrationMode: true
      });
    }
  }, [navigation, selectedGroup]);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const renderWinnerCard = useCallback(({ item, index }) => {
    const isCurrentUser = item.winner?.userId === user?.uid;
    const showGroupName = selectedGroup === 'all' && item.groupName;
    const isFirstInRow = index % 2 === 0;
    const isLastInRow = index % 2 === 1;
    
    return (
      <WinnerArchiveCard
        winner={item}
        onPress={() => handleWinnerPress(item)}
        isCurrentUser={isCurrentUser}
        showGroupName={showGroupName}
        isFirstInRow={isFirstInRow}
        isLastInRow={isLastInRow}
      />
    );
  }, [user?.uid, selectedGroup, handleWinnerPress]);

  const renderFooter = useCallback(() => {
    if (!archiveLoading) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={theme.colors.secondary} />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  }, [archiveLoading]);

  const renderHeader = useCallback(() => (
    <View style={styles.headerSection}>
      <Text style={styles.headerTitle}>
        {selectedGroup === 'all' 
          ? 'All Groups\' Hall of Flame' 
          : `${selectedGroupName}'s Hall of Flame`
        }
      </Text>
    </View>
  ), [selectedGroup, selectedGroupName]);

  // Celebration mode helper functions - moved to top level
  const getGroupDisplayName = useCallback(() => {
    if (selectedGroup === 'all') {
      return celebratedFit?.groupName || 'Group';
    }
    return selectedGroupName;
  }, [selectedGroup, selectedGroupName, celebratedFit?.groupName]);

  const handleGroupArchivePress = useCallback(() => {
    // Navigate to the specific group's Hall of Flame archive
    const targetGroup = selectedGroup === 'all' ? 'all' : selectedGroup;
    navigation.navigate('HallOfFlame', { 
      selectedGroup: targetGroup
    });
  }, [navigation, selectedGroup]);

  // Celebration mode archive press handler - moved to top level
  const handleCelebrationArchivePress = useCallback(() => {
    // Always show the correct group name
    const groupDisplayName = selectedGroup === 'all'
      ? (celebratedFit?.groupName || selectedGroupName || 'Group')
      : (selectedGroupName || celebratedFit?.groupName || 'Group');
    
    // Navigate to the specific group's Hall of Flame archive
    navigation.navigate('HallOfFlame', { 
      selectedGroup,
      selectedGroupName: groupDisplayName,
      userGroups
    });
  }, [navigation, selectedGroup, selectedGroupName, celebratedFit?.groupName, userGroups]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (celebrationMode && winnerFitId) {
      fetchCelebratedFit();
    } else {
      fetchArchive(0, false);
    }
    
    return () => { 
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [celebrationMode, winnerFitId, fetchCelebratedFit, fetchArchive]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
          <Text style={styles.loadingText}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Celebration mode: show single celebrated fit
  if (celebrationMode && celebratedFit) {
    // Always show the correct group name
    const groupDisplayName = selectedGroup === 'all'
      ? (celebratedFit.groupName || selectedGroupName || 'Group')
      : (selectedGroupName || celebratedFit.groupName || 'Group');

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Winner</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.celebrationContainer}>
            {/* Winner's Fit - Hero Image */}
            <View style={styles.fitHeroContainer}>
              <OptimizedImage
                source={{ uri: celebratedFit.imageURL }}
                style={styles.fitHeroImage}
                contentFit="cover"
                showLoadingIndicator={true}
              />
              {/* Winner Badge Overlay */}
              <View style={styles.winnerBadgeOverlay}>
                <Ionicons name="trophy" size={24} color="#FFD700" />
                <Text style={styles.winnerBadgeText}>WINNER</Text>
              </View>
              {/* Tag Overlay */}
              {celebratedFit.tag && (
                <View style={styles.tagOverlay}>
                  <Text style={styles.tagOverlayText}>#{celebratedFit.tag}</Text>
                </View>
              )}
            </View>
            {/* Winner Info Section */}
            <View style={styles.winnerInfoSection}>
              {/* User Profile Row */}
              <View style={styles.userProfileRow}>
                <View style={styles.profileImageContainer}>
                  {celebratedFit.userProfileImageURL ? (
                    <OptimizedImage
                      source={{ uri: celebratedFit.userProfileImageURL }}
                      style={styles.profileImage}
                      showLoadingIndicator={false}
                    />
                  ) : (
                    <View style={styles.profilePlaceholder}>
                      <Ionicons name="person" size={24} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {celebratedFit.userName || 'Unknown User'}
                  </Text>
                  <Text style={styles.userSubtitle}>
                    {groupDisplayName}
                  </Text>
                </View>
              </View>
              {/* Rating Stats */}
              <View style={styles.ratingStatsContainer}>
                <View style={styles.ratingStat}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.ratingValue}>
                    {celebratedFit.fairRating?.toFixed(1) || '0.0'}
                  </Text>
                  <Text style={styles.ratingLabel}>Average</Text>
                </View>
                <View style={styles.ratingDivider} />
                <View style={styles.ratingStat}>
                  <Ionicons name="people" size={20} color="#FFD700" />
                  <Text style={styles.ratingValue}>
                    {celebratedFit.ratingCount || '0'}
                  </Text>
                  <Text style={styles.ratingLabel}>Ratings</Text>
                </View>
              </View>
            </View>
            {/* Fit Details Section */}
            <View style={styles.fitDetailsSection}>
              {celebratedFit.caption && (
                <Text style={styles.fitCaption}>"{celebratedFit.caption}"</Text>
              )}
            </View>
            {/* Action Button */}
            <View style={styles.actionButtonsSection}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCelebrationArchivePress}
                activeOpacity={0.8}
              >
                <Ionicons name="trophy" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  View All Winners
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!winnerHistory || winnerHistory.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Past Winners</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Empty State */}
        <View style={styles.emptyContainer}>
          <Ionicons name="images" size={80} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>
            No Winners Yet
          </Text>
                        <Text style={styles.emptyText}>
                No historical winners found. Start posting fits to build the archive!
              </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
              {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Past Winners</Text>
          <View style={styles.headerSpacer} />
        </View>

      <FlatList
        data={winnerHistory}
        renderItem={renderWinnerCard}
        keyExtractor={(item, index) => item.date || index.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !archiveLoading && (
            <View style={styles.emptyContainer}>
              <Ionicons name="flame" size={80} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>
                No Archive Yet
              </Text>
              <Text style={styles.emptyText}>
                No historical winners found. Start posting fits to build the archive!
              </Text>
            </View>
          )
        }
      />
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 44,
  },

  flatListContent: {
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 16,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 40,
  },
  celebrationContainer: {
    paddingHorizontal: 20,
  },

  fitHeroContainer: {
    width: '100%',
    aspectRatio: 3/4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    ...theme.shadows.lg,
    position: 'relative',
  },
  fitHeroImage: {
    width: '100%',
    height: '100%',
  },
  winnerBadgeOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  winnerBadgeText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tagOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tagOverlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  winnerInfoSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    ...theme.shadows.sm,
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 15,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  userSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  ratingStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  ratingStat: {
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 5,
  },
  ratingLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  ratingDivider: {
    width: 1,
    height: '100%',
    backgroundColor: theme.colors.border,
  },
  fitDetailsSection: {
    marginBottom: 20,
  },
  fitCaption: {
    fontSize: 18,
    color: theme.colors.text,
    fontStyle: 'italic',
    lineHeight: 26,
    marginBottom: 12,
  },


  actionButtonsSection: {
    marginTop: 0,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 12,
    marginBottom: 15,
    ...theme.shadows.sm,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },

}); 