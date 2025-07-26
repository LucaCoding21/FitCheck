/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// Helper: Get rating threshold based on group size
const getRatingThreshold = (groupSize) => {
  if (groupSize <= 3) return 1;
  if (groupSize <= 6) return 2;
  if (groupSize <= 10) return 3;
  return 4;
};

// Helper: Get date key in YYYY-MM-DD format
const getDateKey = (date) => date.toISOString().split("T")[0];

// Helper: Get yesterday's date key
const getYesterdayKey = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateKey(yesterday);
};

// Scheduled function that runs daily at midnight to calculate winners for all groups
exports.calculateDailyWinners = onSchedule({
  schedule: "0 0 * * *",
  timeZone: "America/Vancouver",
}, async (event) => {
  try {
    console.log("Starting daily winner calculation...");

    const yesterdayKey = getYesterdayKey();
    console.log(`Calculating winners for date: ${yesterdayKey}`);

    // Get all groups
    const groupsSnapshot = await db.collection("groups").get();

    if (groupsSnapshot.empty) {
      console.log("No groups found");
      return null;
    }

    const groups = groupsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`Found ${groups.length} groups to process`);

    // Calculate winners for each group
    const results = [];

    for (const group of groups) {
      try {
        console.log(`Processing group: ${group.name} (${group.id})`);

        // Get fits for this group and date
        const fitsSnapshot = await db.collection("fits")
            .where("groupIds", "array-contains", group.id)
            .where("date", "==", yesterdayKey)
            .get();

        const fits = fitsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        console.log(`Found ${fits.length} fits for group ${group.name}`);

        if (fits.length === 0) {
          console.log(`No fits found for group ${group.name}, skipping`);
          continue;
        }

        // Filter by rating threshold
        const threshold = getRatingThreshold(group.memberCount || 1);
        const eligibleFits = fits.filter((fit) => (fit.ratingCount || 0) >= threshold);

        console.log(
            `Found ${eligibleFits.length} eligible fits (threshold: ${threshold})`
        );

        if (eligibleFits.length === 0) {
          console.log(`No eligible fits for group ${group.name}, skipping`);
          continue;
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
          const aTime = (a.createdAt && a.createdAt.toMillis && a.createdAt.toMillis()) ||
              (a.createdAt && a.createdAt.seconds) || 0;
          const bTime = (b.createdAt && b.createdAt.toMillis && b.createdAt.toMillis()) ||
              (b.createdAt && b.createdAt.seconds) || 0;

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

        // Prepare winner data
        const winnerData = {
          date: yesterdayKey,
          winner: {
            fitId: winner.id,
            userId: winner.userId,
            userName: winner.userName,
            userProfileImageURL: winner.userProfileImageURL,
            imageURL: winner.imageURL,
            caption: winner.caption,
            tag: (winner.tags && winner.tags[0]) || "",
            averageRating: winner.fairRating,
            ratingCount: winner.ratingCount,
            createdAt: winner.createdAt,
          },
          calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
          groupId: group.id,
          groupName: group.name,
        };

        // Store winner in group's dailyWinners subcollection
        await db.collection("groups").doc(group.id)
            .collection("dailyWinners")
            .doc(yesterdayKey)
            .set(winnerData);

        console.log(
            `Winner calculated for group ${group.name}: ${winner.userName} (${winner.fairRating}⭐)`
        );

        results.push({
          groupId: group.id,
          groupName: group.name,
          winner: winner.userName,
          rating: winner.fairRating,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing group ${group.name}:`, error);
        results.push({
          groupId: group.id,
          groupName: group.name,
          error: error.message,
          success: false,
        });
      }
    }

    console.log("Daily winner calculation completed");
    console.log("Results:", results);

    return {
      date: yesterdayKey,
      groupsProcessed: groups.length,
      winnersCalculated: results.filter((r) => r.success).length,
      results: results,
    };
  } catch (error) {
    console.error("Error in calculateDailyWinners:", error);
    throw error;
  }
});

// Manual trigger function for testing (can be removed in production)
exports.calculateDailyWinnersManual = onRequest(async (req, res) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Simple authentication (you can enhance this)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).send("Unauthorized");
      return;
    }

    // Call the scheduled function logic
    const result = await exports.calculateDailyWinners.run();

    res.status(200).json({
      success: true,
      result: result,
    });
  } catch (error) {
    console.error("Error in manual trigger:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
