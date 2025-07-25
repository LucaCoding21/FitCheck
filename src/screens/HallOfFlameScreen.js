import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import { 
  getWinnerHistoryForGroup, 
  getWinnerArchiveForGroup,
  getWinnerStatsForGroup,
  getTopPerformersForGroup
} from '../services/DailyWinnerService';
import { theme } from '../styles/theme';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import WinnerArchiveCard from '../components/WinnerArchiveCard';

const { width } = Dimensions.get('window');

export default function HallOfFlameScreen({ navigation, route }) {
  const { user } = useAuth();
  const selectedGroup = route?.params?.selectedGroup || 'all';
  const winnerFitId = route?.params?.winnerFitId || null;
  const celebrationMode = route?.params?.celebrationMode || false;
  const initialArchiveMode = route?.params?.archiveMode || false;
  const [winnerHistory, setWinnerHistory] = useState([]);
  const [celebratedFit, setCelebratedFit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveMode, setArchiveMode] = useState(initialArchiveMode);
  const [hasMoreWinners, setHasMoreWinners] = useState(true);
  const [archiveOffset, setArchiveOffset] = useState(0);
  const isMountedRef = useRef(true);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (celebrationMode && winnerFitId) {
      fetchCelebratedFit();
    } else {
      fetchHistory();
    }
    
    return () => { 
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user?.uid, selectedGroup, winnerFitId, celebrationMode]);

  useEffect(() => {
    // If archiveMode was passed as a parameter, fetch archive data
    if (initialArchiveMode && !celebrationMode && !loading) {
      handleArchiveModeToggle();
    }
  }, [initialArchiveMode, loading, celebrationMode]);

  const fetchCelebratedFit = async () => {
    if (!winnerFitId) return;

    try {
      setLoading(true);
      const fitRef = doc(db, 'fits', winnerFitId);
      
      const unsubscribe = onSnapshot(fitRef, (doc) => {
        if (doc.exists() && isMountedRef.current) {
          const fitData = { id: doc.id, ...doc.data() };
          setCelebratedFit(fitData);
        }
        if (isMountedRef.current) setLoading(false);
      });

      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('Error fetching celebrated fit:', error);
      if (isMountedRef.current) setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!user?.uid || !selectedGroup) {
      setWinnerHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const history = await getWinnerHistoryForGroup(user.uid, selectedGroup);
    if (isMountedRef.current) setWinnerHistory(history);
    setLoading(false);
  };

  const fetchArchive = async (offset = 0, append = false) => {
    if (!user?.uid || !selectedGroup) return;

    try {
      setArchiveLoading(true);
      const archive = await getWinnerArchiveForGroup(user.uid, selectedGroup, 20, offset);
      
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
      if (isMountedRef.current) setArchiveLoading(false);
    }
  };

  const handleArchiveModeToggle = async () => {
    if (archiveMode) {
      // Switch back to recent winners
      setArchiveMode(false);
      setArchiveOffset(0);
      setHasMoreWinners(true);
      fetchHistory();
    } else {
      // Switch to archive mode
      setArchiveMode(true);
      setArchiveOffset(0);
      setHasMoreWinners(true);
      await fetchArchive(0, false);
    }
  };

  const handleLoadMore = () => {
    if (!archiveLoading && hasMoreWinners && archiveMode) {
      fetchArchive(archiveOffset, true);
    }
  };

  const handleWinnerPress = (winner) => {
    if (winner?.winner?.fitId) {
      navigation.navigate('HallOfFlame', {
        selectedGroup,
        winnerFitId: winner.winner.fitId,
        celebrationMode: true
      });
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const renderWinnerCard = ({ item }) => {
    const isCurrentUser = item.winner?.userId === user?.uid;
    const showGroupName = selectedGroup === 'all' && item.groupName;
    
    return (
      <WinnerArchiveCard
        winner={item}
        onPress={() => handleWinnerPress(item)}
        isCurrentUser={isCurrentUser}
        showGroupName={showGroupName}
      />
    );
  };

  const renderFooter = () => {
    if (!archiveLoading) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={theme.colors.secondary} />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <Text style={styles.headerTitle}>
        {archiveMode ? 'Winner Archive' : 'Recent Winners'}
      </Text>
      <Text style={styles.headerSubtitle}>
        {selectedGroup === 'all' 
          ? 'All groups' 
          : selectedGroup
        }
      </Text>
    </View>
  );

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
    // Get the group name to display on the button
    const getGroupDisplayName = () => {
      if (selectedGroup === 'all') {
        return celebratedFit.groupName || 'Group';
      }
      return selectedGroup;
    };

    const handleGroupArchivePress = () => {
      // Navigate to the specific group's Hall of Flame archive
      const targetGroup = selectedGroup === 'all' ? 'all' : selectedGroup;
      navigation.navigate('HallOfFlame', { 
        selectedGroup: targetGroup,
        archiveMode: true
      });
    };

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

        <View style={styles.celebrationContainer}>
          {/* Fit Image */}
          <View style={styles.fitImageContainer}>
            <OptimizedImage
              source={{ uri: celebratedFit.imageURL }}
              style={styles.fitImage}
              contentFit="cover"
              showLoadingIndicator={true}
            />
          </View>

          {/* Fit Info */}
          <View style={styles.fitInfo}>
            <Text style={styles.fitUserName}>
              {celebratedFit.userName || 'Unknown User'}
            </Text>
            <Text style={styles.fitGroupName}>
              {selectedGroup === 'all' ? 'All Groups' : 'Group'}
            </Text>
            {celebratedFit.caption && (
              <Text style={styles.fitCaption}>"{celebratedFit.caption}"</Text>
            )}
            {celebratedFit.tag && (
              <Text style={styles.fitTag}>#{celebratedFit.tag}</Text>
            )}
          </View>

          {/* Group Archive Button */}
          <TouchableOpacity
            style={styles.groupArchiveButton}
            onPress={handleGroupArchivePress}
            activeOpacity={0.8}
          >
            <Ionicons name="trophy" size={20} color="#B5483D" />
            <Text style={styles.groupArchiveText}>
              View {getGroupDisplayName()} Hall of Flame
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#B5483D" />
          </TouchableOpacity>
        </View>
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
          <Text style={styles.headerTitle}>Hall of Flame</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Empty State */}
        <View style={styles.emptyContainer}>
          <Ionicons name="images" size={80} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>
            No Winners Yet
          </Text>
          <Text style={styles.emptyText}>
            {archiveMode 
              ? 'No historical winners found. Start posting fits to build the archive!'
              : 'Yesterday\'s competition is still being calculated. Check back soon!'
            }
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
        <Text style={styles.headerTitle}>Hall of Flame</Text>
        <TouchableOpacity
          style={styles.archiveToggleButton}
          onPress={handleArchiveModeToggle}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={archiveMode ? "time" : "archive"} 
            size={20} 
            color={theme.colors.secondary} 
          />
        </TouchableOpacity>
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
        columnWrapperStyle={styles.row}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !archiveLoading && (
            <View style={styles.emptyContainer}>
              <Ionicons name="images" size={80} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {archiveMode ? 'No Archive Yet' : 'No Winner Yet'}
              </Text>
              <Text style={styles.emptyText}>
                {archiveMode 
                  ? 'No historical winners found. Start posting fits to build the archive!'
                  : 'Yesterday\'s competition is still being calculated. Check back soon!'
                }
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
  archiveToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  flatListContent: {
    paddingBottom: 40,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    paddingVertical: 24,
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
  celebrationContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  fitImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    ...theme.shadows.lg,
  },
  fitImage: {
    width: '100%',
    height: '100%',
  },
  fitInfo: {
    paddingHorizontal: 4,
  },
  fitUserName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  fitGroupName: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  fitCaption: {
    fontSize: 18,
    color: theme.colors.text,
    fontStyle: 'italic',
    lineHeight: 26,
    marginBottom: 12,
  },
  fitTag: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  groupArchiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 20,
    ...theme.shadows.sm,
  },
  groupArchiveText: {
    fontSize: 16,
    color: '#B5483D',
    fontWeight: '600',
    marginHorizontal: 10,
  },
}); 