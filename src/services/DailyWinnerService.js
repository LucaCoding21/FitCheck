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

// Helper: Generate winner doc key
const getWinnerKey = (userId, groupId, dateKey) => `${userId}_${groupId}_${dateKey}`;

// Helper: Get today's date in YYYY-MM-DD format
const getTodayKey = () => getDateKey(new Date());

// ---
// Calculate and save daily winner for a specific group for a user
export const calculateAndSaveGroupWinner = async (date, group, userId) => {
  try {
    if (!userId || !group?.id) throw new Error('User ID and group required');
    const dateKey = getDateKey(date);
    const winnerKey = getWinnerKey(userId, group.id, dateKey);
    
    // Check if winner already exists
    const existingDoc = await getDoc(doc(db, 'dailyWinners', winnerKey));
    if (existingDoc.exists()) {
      return existingDoc.data();
    }

    // Fetch fits for this group and date
    // Updated to handle groupIds array structure
    const fitsQuery = query(
      collection(db, 'fits'),
      where('groupIds', 'array-contains', group.id),
      where('date', '==', dateKey)
    );
    const snapshot = await getDocs(fitsQuery);
    const fits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter by rating threshold
    const threshold = getRatingThreshold(group.memberCount || 1);
    const eligibleFits = fits.filter(fit => (fit.ratingCount || 0) >= threshold);
    
    if (!eligibleFits.length) {
      return null;
    }
    
    // Sort with tie-breaking logic:
    // 1. Primary: Average rating (highest first)
    // 2. Secondary: Number of ratings (more ratings wins)
    // 3. Tertiary: Posting time (earlier post wins)
    const sorted = eligibleFits.sort((a, b) => {
      const aRating = a.fairRating || 0;
      const bRating = b.fairRating || 0;
      const aCount = a.ratingCount || 0;
      const bCount = b.ratingCount || 0;
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      
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
    
    const winner = sorted[0];
    if (!winner) return null;
    
    // Prepare winner data
    const winnerData = {
      userId,
      groupId: group.id,
      groupName: group.name,
      date: dateKey,
      winner: {
        fitId: winner.id,
        userId: winner.userId,
        userName: winner.userName,
        userProfileImageURL: winner.userProfileImageURL,
        imageURL: winner.imageURL,
        caption: winner.caption,
        tag: winner.tag,
        averageRating: winner.fairRating, // Map fairRating to averageRating for consistency
        ratingCount: winner.ratingCount,
        createdAt: winner.createdAt,
      },
      calculatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'dailyWinners', winnerKey), winnerData);
    return winnerData;
  } catch (e) {
    console.error('Error calculating group winner', e);
    throw e;
  }
};

// Calculate and save 'all' winner for a user (across all groups)
export const calculateAndSaveAllWinner = async (date, userGroups, userId) => {
  try {
    if (!userId || !userGroups?.length) throw new Error('User ID and groups required');
    const dateKey = getDateKey(date);
    const winnerKey = getWinnerKey(userId, 'all', dateKey);
    // Check if winner already exists
    const existingDoc = await getDoc(doc(db, 'dailyWinners', winnerKey));
    if (existingDoc.exists()) return existingDoc.data();
    
    // Fetch all fits for all groups for this date
    let allFits = [];
    for (const group of userGroups) {
      // Updated to handle groupIds array structure
      const fitsQuery = query(
        collection(db, 'fits'),
        where('groupIds', 'array-contains', group.id),
        where('date', '==', dateKey)
      );
      const snapshot = await getDocs(fitsQuery);
      const fits = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        groupName: group.name, 
        groupId: group.id, // Add groupId for compatibility
        groupMemberCount: group.memberCount 
      }));
      allFits = allFits.concat(fits);
    }
    
    // Filter by each fit's group threshold
    const eligibleFits = allFits.filter(fit => {
      const group = userGroups.find(g => g.id === fit.groupId);
      const threshold = getRatingThreshold(group?.memberCount || 1);
      return (fit.ratingCount || 0) >= threshold;
    });
    
    if (!eligibleFits.length) return null;
    
    // Sort with tie-breaking logic:
    // 1. Primary: Average rating (highest first)
    // 2. Secondary: Number of ratings (more ratings wins)
    // 3. Tertiary: Posting time (earlier post wins)
    const sorted = eligibleFits.sort((a, b) => {
      const aRating = a.fairRating || 0;
      const bRating = b.fairRating || 0;
      const aCount = a.ratingCount || 0;
      const bCount = b.ratingCount || 0;
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
      
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
    
    const winner = sorted[0];
    if (!winner) return null;
    
    // Prepare winner data
    const winnerData = {
      userId,
      groupId: 'all',
      groupName: 'All',
      date: dateKey,
      winner: {
        fitId: winner.id,
        userId: winner.userId,
        userName: winner.userName,
        userProfileImageURL: winner.userProfileImageURL,
        imageURL: winner.imageURL,
        caption: winner.caption,
        tag: winner.tag,
        averageRating: winner.fairRating, // Map fairRating to averageRating for consistency
        ratingCount: winner.ratingCount,
        groupId: winner.groupId,
        groupName: winner.groupName,
        createdAt: winner.createdAt,
      },
      calculatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'dailyWinners', winnerKey), winnerData);
    return winnerData;
  } catch (e) {
    console.error('Error calculating all winner', e);
    throw e;
  }
};

// Fetch winner for a specific group and date
export const getGroupWinner = async (userId, groupId, date) => {
  try {
    const dateKey = getDateKey(date);
    const winnerKey = getWinnerKey(userId, groupId, dateKey);
    const docSnap = await getDoc(doc(db, 'dailyWinners', winnerKey));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (e) {
    console.error('Error fetching group winner', e);
    return null;
  }
};

// Fetch 'all' winner for a user and date
export const getAllWinner = async (userId, date) => {
  try {
    const dateKey = getDateKey(date);
    const winnerKey = getWinnerKey(userId, 'all', dateKey);
    const docSnap = await getDoc(doc(db, 'dailyWinners', winnerKey));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (e) {
    console.error('Error fetching all winner', e);
    return null;
  }
};

// Fetch winner for yesterday for a group or 'all'
export const getYesterdayWinner = async (userId, groupId) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (groupId === 'all') {
    return await getAllWinner(userId, yesterday);
  }
  return await getGroupWinner(userId, groupId, yesterday);
};

// Fetch winner history for a group (for Hall of Flame)
export const getWinnerHistoryForGroup = async (userId, groupId, limitCount = 30) => {
  try {
    const winnersQuery = query(
      collection(db, 'dailyWinners'),
      where('userId', '==', userId),
      where('groupId', '==', groupId),
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
export const getWinnerArchiveForGroup = async (userId, groupId, limitCount = 50, offset = 0) => {
  try {
    const todayKey = getTodayKey();
    
    const winnersQuery = query(
      collection(db, 'dailyWinners'),
      where('userId', '==', userId),
      where('groupId', '==', groupId),
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
export const getWinnerStatsForGroup = async (userId, groupId) => {
  try {
    const todayKey = getTodayKey();
    
    const winnersQuery = query(
      collection(db, 'dailyWinners'),
      where('userId', '==', userId),
      where('groupId', '==', groupId),
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
    
    // Get current user's wins
    const currentUserWins = winners.filter(w => w.winner.userId === userId).length;
    
    return {
      totalWins,
      uniqueWinners,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      currentUserWins,
      totalDays: winners.length
    };
  } catch (e) {
    console.error('Error fetching winner stats for group', e);
    return {
      totalWins: 0,
      uniqueWinners: 0,
      averageRating: 0,
      currentUserWins: 0,
      totalDays: 0
    };
  }
};

// NEW: Get user's win count for a specific group
export const getUserWinCount = async (userId, groupId) => {
  try {
    const todayKey = getTodayKey();
    
    const winnersQuery = query(
      collection(db, 'dailyWinners'),
      where('userId', '==', userId),
      where('groupId', '==', groupId),
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
export const getTopPerformersForGroup = async (userId, groupId, limitCount = 5) => {
  try {
    const todayKey = getTodayKey();
    
    const winnersQuery = query(
      collection(db, 'dailyWinners'),
      where('userId', '==', userId),
      where('groupId', '==', groupId),
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

// Calculate and save all winners for a user for a given date (all groups + 'all')
export const calculateAndSaveAllWinnersForUser = async (date, userGroups, userId) => {
  // For each group
  for (const group of userGroups) {
    await calculateAndSaveGroupWinner(date, group, userId);
  }
  // For 'all'
  await calculateAndSaveAllWinner(date, userGroups, userId);
}; 