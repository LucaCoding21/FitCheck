const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'fitcheck-28882'
});

const db = admin.firestore();

/**
 * Migration script to initialize notification schema for existing users
 * Run this script once to add new notification fields to existing users
 */
async function migrateNotificationSchema() {
  console.log('Starting notification schema migration...');
  
  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // Check if user already has the new notification fields
        const hasNewFields = userData.notifDailyCount !== undefined || 
                           userData.notifLastSent !== undefined ||
                           userData.timezone !== undefined;
        
        if (hasNewFields) {
          console.log(`User ${userId} already has new fields, skipping`);
          continue;
        }
        
        // Prepare updates
        const updates = {};
        
        // Initialize notification preferences if not exists
        if (!userData.notificationPreferences) {
          updates.notificationPreferences = {
            commentNotifications: true,
            ratingNotifications: true,
            newFitNotifications: true,
            postReminderNotifications: true,
            leaderboardNotifications: true,
            newMemberNotifications: true,
          };
        }
        
        // Initialize notification tracking fields
        updates.notifDailyCount = {};
        updates.notifLastSent = {};
        
        // Set timezone (default to UTC, users can update later)
        updates.timezone = 'America/Vancouver';
        
        // Update user document
        await db.collection('users').doc(userId).update(updates);
        
        migratedCount++;
        console.log(`Migrated user ${userId}`);
        
        // Add small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error migrating user ${userDoc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Migration completed!`);
    console.log(`Successfully migrated: ${migratedCount} users`);
    console.log(`Errors: ${errorCount} users`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

/**
 * Migration script to initialize notification queues collection
 */
async function initializeNotificationQueues() {
  console.log('Initializing notification queues collection...');
  
  try {
    // Create a sample queue document to ensure the collection exists
    await db.collection('notificationQueues').add({
      _migration: true,
      createdAt: admin.firestore.Timestamp.fromDate(new Date()),
      description: 'Migration placeholder - can be deleted',
    });
    
    console.log('Notification queues collection initialized');
  } catch (error) {
    console.error('Error initializing notification queues:', error);
  }
}

/**
 * Migration script to initialize app config
 */
async function initializeAppConfig() {
  console.log('Initializing app config...');
  
  try {
    await db.collection('appConfig').doc('notifications').set({
      NOTIF_DAILY_CAP: 3,
      COMMENT_DAILY_CAP: 5,
      FRIEND_POST_COOLDOWN_MIN: 90,
      RATING_BUNDLE_THRESHOLD: 3,
      LAST_HOUR_FEATURE_FLAG: false,
      POST_REMINDER_WINDOW_START: 14,
      POST_REMINDER_WINDOW_END: 16,
      createdAt: admin.firestore.Timestamp.fromDate(new Date()),
      updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
    });
    
    console.log('App config initialized');
  } catch (error) {
    console.error('Error initializing app config:', error);
  }
}

/**
 * Clean up migration data
 */
async function cleanupMigration() {
  console.log('Cleaning up migration data...');
  
  try {
    // Remove migration placeholder from notification queues
    const migrationDocs = await db.collection('notificationQueues')
      .where('_migration', '==', true)
      .get();
    
    for (const doc of migrationDocs.docs) {
      await doc.ref.delete();
    }
    
    console.log(`Cleaned up ${migrationDocs.size} migration documents`);
  } catch (error) {
    console.error('Error cleaning up migration:', error);
  }
}

// Main migration function
async function runMigration() {
  console.log('=== FitCheck Notification Schema Migration ===');
  
  try {
    await initializeAppConfig();
    await initializeNotificationQueues();
    await migrateNotificationSchema();
    await cleanupMigration();
    
    console.log('=== Migration completed successfully ===');
  } catch (error) {
    console.error('=== Migration failed ===', error);
  }
}

// Export functions for manual execution
module.exports = {
  migrateNotificationSchema,
  initializeNotificationQueues,
  initializeAppConfig,
  cleanupMigration,
  runMigration,
};

// Run migration if this script is executed directly
if (require.main === module) {
  runMigration();
} 