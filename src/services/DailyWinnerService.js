import { doc, setDoc, getDoc, getDocs, collection, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// Helper: Get rating threshold based on group size
const getRatingThreshold = (groupSize) => {
  if (groupSize <= 3) return 1;
  if (groupSize <= 6) return 2;
  if (groupSize <= 10) return 3;
  return 4;
};

// Helper: Get date key in YYYY-MM-DD format
const getDateKey = (date) => date.toISOString().split('T')[0];

// Helper: Get today's date in YYYY-MM-DD format
const getTodayKey = () => getDateKey(new Date());

// ---
// NEW: Fetch winner for a specific group and date from group subcollection
export const getGroupWinner = async (groupId, date) => {
  try {
    const dateKey = getDateKey(date);
    const docSnap = await getDoc(doc(db, 'groups', groupId, 'dailyWinners', dateKey));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (e) {
    console.error('Error fetching group winner', e);
    return null;
  }
};

// NEW: Fetch winner for yesterday for a group
export const getYesterdayWinner = async (groupId) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return await getGroupWinner(groupId, yesterday);
};

// NEW: Fetch winner history for a group (for Hall of Flame)
export const getWinnerHistoryForGroup = async (groupId, limitCount = 30) => {
  try {
    const winnersQuery = query(
      collection(db, 'groups', groupId, 'dailyWinners'),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(winnersQuery);
    return snapshot.docs.slice(0, limitCount).map(doc => doc.data());
  } catch (e) {
    console.error('Error fetching winner history for group', e);
    return [];
  }
};

// NEW: Fetch winner archive for a group (all historical winners before today)
export const getWinnerArchiveForGroup = async (groupId, limitCount = 50, offset = 0) => {
  try {
    const todayKey = getTodayKey();
    
    const winnersQuery = query(
      collection(db, 'groups', groupId, 'dailyWinners'),
      where('date', '<', todayKey), // Only winners before today
      orderBy('date', 'desc'),
      limit(limitCount + offset)
    );
    
    const snapshot = await getDocs(winnersQuery);
    const allWinners = snapshot.docs.map(doc => doc.data());
    
    // Apply offset and limit
    return allWinners.slice(offset, offset + limitCount);
  } catch (e) {
    console.error('Error fetching winner archive for group', e);
    return [];
  }
};

// NEW: Get winner statistics for a group
export const getWinnerStatsForGroup = async (groupId) => {
  try {
    const todayKey = getTodayKey();
    
    const winnersQuery = query(
      collection(db, 'groups', groupId, 'dailyWinners'),
      where('date', '<', todayKey)
    );
    
    const snapshot = await getDocs(winnersQuery);
    const winners = snapshot.docs.map(doc => doc.data());
    
    // Calculate statistics
    const totalWins = winners.length;
    const uniqueWinners = new Set(winners.map(w => w.winner.userId)).size;
    const averageRating = winners.length > 0 
      ? winners.reduce((sum, w) => sum + (w.winner.averageRating || 0), 0) / winners.length 
      : 0;
    
    return {
      totalWins,
      uniqueWinners,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalDays: winners.length
    };
  } catch (e) {
    console.error('Error fetching winner stats for group', e);
    return {
      totalWins: 0,
      uniqueWinners: 0,
      averageRating: 0,
      totalDays: 0
    };
  }
};

// NEW: Get user's win count for a specific group
export const getUserWinCount = async (userId, groupId) => {
  try {
    const todayKey = getTodayKey();
    
    const winnersQuery = query(
      collection(db, 'groups', groupId, 'dailyWinners'),
      where('date', '<', todayKey)
    );
    
    const snapshot = await getDocs(winnersQuery);
    const winners = snapshot.docs.map(doc => doc.data());
    
    return winners.filter(w => w.winner.userId === userId).length;
  } catch (e) {
    console.error('Error fetching user win count', e);
    return 0;
  }
};

// NEW: Get top performers for a group
export const getTopPerformersForGroup = async (groupId, limitCount = 5) => {
  try {
    const todayKey = getTodayKey();
    
    const winnersQuery = query(
      collection(db, 'groups', groupId, 'dailyWinners'),
      where('date', '<', todayKey)
    );
    
    const snapshot = await getDocs(winnersQuery);
    const winners = snapshot.docs.map(doc => doc.data());
    
    // Count wins per user
    const winCounts = {};
    winners.forEach(winner => {
      const winnerUserId = winner.winner.userId;
      winCounts[winnerUserId] = (winCounts[winnerUserId] || 0) + 1;
    });
    
    // Convert to array and sort
    const performers = Object.entries(winCounts).map(([userId, wins]) => ({
      userId,
      wins,
      userName: winners.find(w => w.winner.userId === userId)?.winner.userName || 'Unknown'
    }));
    
    return performers
      .sort((a, b) => b.wins - a.wins)
      .slice(0, limitCount);
  } catch (e) {
    console.error('Error fetching top performers', e);
    return [];
  }
};

// NEW: Get "All" winner by aggregating from user's groups
export const getAllWinner = async (userGroups, date) => {
  try {
    if (!userGroups?.length) return null;
    
    const dateKey = getDateKey(date);
    let allWinners = [];
    
    // Get winners from all user's groups for the specified date
    for (const group of userGroups) {
      const groupWinner = await getGroupWinner(group.id, date);
      if (groupWinner) {
        allWinners.push({
          ...groupWinner,
          groupName: group.name,
          groupId: group.id
        });
      }
    }
    
    if (allWinners.length === 0) return null;
    
    // Sort with tie-breaking logic (same as Cloud Function):
    // 1. Primary: Average rating (highest first)
    // 2. Secondary: Number of ratings (more ratings wins)
    // 3. Tertiary: Posting time (earlier post wins)
    const sorted = allWinners.sort((a, b) => {
      const aRating = a.winner.averageRating || 0;
      const bRating = b.winner.averageRating || 0;
      const aCount = a.winner.ratingCount || 0;
      const bCount = b.winner.ratingCount || 0;
      const aTime = a.winner.createdAt?.toMillis?.() || a.winner.createdAt?.seconds || 0;
      const bTime = b.winner.createdAt?.toMillis?.() || b.winner.createdAt?.seconds || 0;
      
      // Primary: Compare average ratings
      if (aRating !== bRating) {
        return bRating - aRating; // Higher rating wins
      }
      
      // Secondary: If ratings are tied, compare rating counts
      if (aCount !== bCount) {
        return bCount - aCount; // More ratings wins
      }
      
      // Tertiary: If rating counts are tied, compare posting times
      return aTime - bTime; // Earlier post wins
    });
    
    return sorted[0];
  } catch (e) {
    console.error('Error fetching all winner', e);
    return null;
  }
};

// NEW: Get "All" winner for yesterday
export const getYesterdayAllWinner = async (userGroups) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return await getAllWinner(userGroups, yesterday);
};

// NEW: Get "All" winner history by aggregating from user's groups
export const getAllWinnerHistory = async (userGroups, limitCount = 30) => {
  try {
    if (!userGroups?.length) return [];
    
    // Get all winners from all groups
    let allWinners = [];
    for (const group of userGroups) {
      const groupWinners = await getWinnerHistoryForGroup(group.id, limitCount);
      allWinners = allWinners.concat(groupWinners.map(w => ({
        ...w,
        groupName: group.name,
        groupId: group.id
      })));
    }
    
    // Sort by date (most recent first) and take top limitCount
    return allWinners
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limitCount);
  } catch (e) {
    console.error('Error fetching all winner history', e);
    return [];
  }
};

// DEPRECATED: Legacy methods for backward compatibility during migration
// These will be removed after migration is complete

export const calculateAndSaveGroupWinner = async (date, group, userId) => {
  console.warn('calculateAndSaveGroupWinner is deprecated - winners are now calculated by Cloud Functions');
  return null;
};

export const calculateAndSaveAllWinner = async (date, userGroups, userId) => {
  console.warn('calculateAndSaveAllWinner is deprecated - winners are now calculated by Cloud Functions');
  return null;
};

export const calculateAndSaveAllWinnersForUser = async (date, userGroups, userId) => {
  console.warn('calculateAndSaveAllWinnersForUser is deprecated - winners are now calculated by Cloud Functions');
  return null;
};

// Legacy methods with new signatures for backward compatibility
export const getGroupWinnerLegacy = async (userId, groupId, date) => {
  console.warn('getGroupWinnerLegacy is deprecated - use getGroupWinner(groupId, date) instead');
  return await getGroupWinner(groupId, date);
};

export const getAllWinnerLegacy = async (userId, date) => {
  console.warn('getAllWinnerLegacy is deprecated - use getAllWinner(userGroups, date) instead');
  return null; // This needs userGroups which we don't have in legacy signature
};

export const getYesterdayWinnerLegacy = async (userId, groupId) => {
  console.warn('getYesterdayWinnerLegacy is deprecated - use getYesterdayWinner(groupId) instead');
  if (groupId === 'all') {
    console.warn('getYesterdayWinnerLegacy with groupId="all" is deprecated - use getAllWinner with userGroups');
    return null;
  }
  return await getYesterdayWinner(groupId);
};

export const getWinnerHistoryForGroupLegacy = async (userId, groupId, limitCount = 30) => {
  console.warn('getWinnerHistoryForGroupLegacy is deprecated - use getWinnerHistoryForGroup(groupId, limitCount) instead');
  return await getWinnerHistoryForGroup(groupId, limitCount);
}; 