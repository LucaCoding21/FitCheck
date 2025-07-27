# FitCheck Push Notification System v1

## Overview

The FitCheck notification system provides intelligent, user-friendly push notifications with smart batching, daily caps, and cooldown management. Built with Firebase Cloud Functions and Expo Notifications.

## Architecture

### Components

1. **Cloud Functions** - Server-side notification logic and scheduling
2. **Client-side hooks** - React hooks for notification preferences
3. **Firestore collections** - Data storage for notifications and queues
4. **Expo Notifications** - Push notification delivery

### Key Features

- **Daily Caps**: Max 3 notifications per user per day (5 for comments)
- **Smart Batching**: Bundle similar notifications to reduce spam
- **Cooldown Management**: Prevent notification spam with time-based limits
- **Template Variants**: Rotate notification copy for variety
- **User Preferences**: Granular control over notification types
- **Timezone Awareness**: Respect user timezones for scheduling

## Database Schema

### User Document Updates

```javascript
// New fields added to users/{userId}
{
  // ... existing fields ...

  // Notification tracking
  notifDailyCount: {
    "2024-01-15": {
      "comment": 2,
      "friends_posted": 1,
      "ratings_bundled": 1
    }
  },

  notifLastSent: {
    "friends_posted": Timestamp,
    "comment": Timestamp
  },

  // Enhanced notification preferences
  notificationPreferences: {
    commentNotifications: true,
    ratingNotifications: true,
    newFitNotifications: true,
    postReminderNotifications: true,
    leaderboardNotifications: true,
    newMemberNotifications: true
  },

  timezone: "America/Vancouver"
}
```

### New Collections

#### `notificationQueues/{queueId}`

```javascript
{
  userId: string,
  type: "friends_posted" | "ratings_bundled",
  data: {
    fitId?: string,
    groupId?: string,
    count?: number,
    // ... other context data
  },
  dateKey: "2024-01-15",
  createdAt: Timestamp,
  processed: boolean
}
```

#### `appConfig/notifications`

```javascript
{
  NOTIF_DAILY_CAP: 3,
  COMMENT_DAILY_CAP: 5,
  FRIEND_POST_COOLDOWN_MIN: 90,
  RATING_BUNDLE_THRESHOLD: 3,
  LAST_HOUR_FEATURE_FLAG: false,
  POST_REMINDER_WINDOW_START: 14,
  POST_REMINDER_WINDOW_END: 16
}
```

## Cloud Functions

### Trigger Functions

1. **`onPostCreated`** - Queues "friends posted" notifications
2. **`onRatingCreated`** - Buffers ratings, sends bundled notifications
3. **`onCommentCreated`** - Immediate comment notifications
4. **`onUserJoinedGroup`** - New member notifications (optional)

### Scheduled Functions

1. **`dailyResetScheduler`** - Daily at midnight

   - Calculates winners
   - Sends winner/recap notifications
   - Resets daily counters

2. **`flushBundlesScheduler`** - Every 15 minutes

   - Processes queued notifications
   - Sends bundled notifications

3. **`postReminderScheduler`** - Daily at 2 PM
   - Sends reminders to users who haven't posted

## Notification Types

### 1. Daily Post Reminder

- **Trigger**: 2-4 PM local time, only if user hasn't posted
- **Cap**: 1/day
- **Variants**: 3 different messages

### 2. Friends Posted (Bundled)

- **Trigger**: When ≥2 friends post in a group
- **Cap**: 2/day
- **Cooldown**: 90 minutes
- **Batching**: Groups notifications by group

### 3. Ratings on Your Fit (Bundled)

- **Trigger**: +3 ratings since last notification
- **Cap**: 1-2/day
- **Batching**: Groups by fit

### 4. Comment on Your Fit (Immediate)

- **Trigger**: When someone comments
- **Cap**: 5/day (separate from general cap)
- **Includes**: Comment snippet (40 chars max)

### 5. Leaderboard Results

- **Trigger**: Daily at midnight
- **Winners**: Get crown notifications
- **Non-winners**: Get recap notifications

### 6. New Member (Optional)

- **Trigger**: When someone joins group
- **Cap**: 1/day
- **Batching**: Optional for MVP

## Client-Side Implementation

### Hook Usage

```typescript
import { useNotificationSettings } from "../hooks/useNotificationSettings";

function MyComponent() {
  const { preferences, loading, error, updatePreference, resetPreferences } =
    useNotificationSettings();

  const handleToggle = async (key: string, value: boolean) => {
    await updatePreference(key, value);
  };

  return (
    <Switch
      value={preferences.commentNotifications}
      onValueChange={(value) => handleToggle("commentNotifications", value)}
    />
  );
}
```

### Notification Constants

```typescript
import {
  NotificationType,
  pickVariant,
  renderTemplate,
} from "../constants/notifications";

// Pick a random variant
const variant = pickVariant(NotificationType.COMMENT, {
  snippet: "Great fit!",
  username: "Alice",
});

// Render template
const message = renderTemplate("Hello {{name}}!", { name: "John" });
```

## Configuration

### Environment Variables

```bash
# Firebase Functions environment
NOTIF_DAILY_CAP=3
COMMENT_DAILY_CAP=5
FRIEND_POST_COOLDOWN_MIN=90
RATING_BUNDLE_THRESHOLD=3
LAST_HOUR_FEATURE_FLAG=false
```

### App Config (Firestore)

Update `appConfig/notifications` document to change thresholds:

```javascript
// Example: Increase daily cap
await db.collection("appConfig").doc("notifications").update({
  NOTIF_DAILY_CAP: 5,
});
```

## Testing

### Local Development

1. **Start Firebase Emulators**:

```bash
cd functions
npm run serve
```

2. **Test Functions**:

```bash
# Test daily winner calculation
curl -X POST https://your-project.cloudfunctions.net/calculateDailyWinnersManual \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Test Notifications**:

```bash
# Send test notification
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[YOUR_TOKEN]",
    "title": "Test",
    "body": "Test notification"
  }'
```

### Unit Tests

```bash
cd functions
npm test
```

## Deployment

### 1. Deploy Cloud Functions

```bash
cd functions
npm run build
npm run deploy
```

### 2. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 3. Deploy Indexes

```bash
firebase deploy --only firestore:indexes
```

### 4. Run Migration

```bash
# Set up service account and run migration
node scripts/migrate-notification-schema.js
```

## Monitoring

### Cloud Function Logs

```bash
firebase functions:log
```

### Key Metrics to Monitor

- Daily notification volume
- Batching effectiveness
- User engagement with notifications
- Error rates
- Delivery success rates

### Common Issues

1. **High notification volume**: Check daily caps and cooldowns
2. **Delivery failures**: Verify Expo push tokens
3. **Batching not working**: Check queue processing
4. **Timezone issues**: Verify user timezone settings

## Performance Considerations

### Scaling

- **Batching**: Reduces notification volume by 60-80%
- **Daily caps**: Prevents notification spam
- **Cooldowns**: Prevents rapid-fire notifications
- **Queue processing**: Handles high-volume periods

### Optimization

- **Batch Firestore operations**: Reduce database calls
- **Index optimization**: Ensure fast queries
- **Memory management**: Clean up old queue entries
- **Rate limiting**: Respect API limits

## Security

### Firestore Rules

- Users can only read their own notification data
- Cloud Functions handle all writes to notification queues
- App config is read-only for clients

### Data Privacy

- No sensitive data in notifications
- User preferences respected
- Anonymous rating notifications
- Minimal data collection

## Future Enhancements

### Planned Features

1. **Smart Timing**: Send notifications at optimal times
2. **A/B Testing**: Test different notification copy
3. **Analytics**: Track notification effectiveness
4. **Custom Schedules**: User-defined notification times
5. **Rich Notifications**: Images and actions

### Advanced Batching

1. **Cross-group bundling**: Bundle across multiple groups
2. **Time-based bundling**: Bundle by time windows
3. **Priority queuing**: Handle urgent notifications first

## Troubleshooting

### Common Problems

1. **Notifications not sending**:

   - Check user preferences
   - Verify push tokens
   - Check daily caps

2. **Batching not working**:

   - Check queue processing
   - Verify thresholds
   - Check function logs

3. **Wrong timing**:
   - Verify timezone settings
   - Check scheduler configuration

### Debug Commands

```bash
# Check user notification data
firebase firestore:get users/USER_ID

# Check notification queues
firebase firestore:get notificationQueues

# Check function logs
firebase functions:log --only dailyResetScheduler
```

## Support

For issues with the notification system:

1. Check Cloud Function logs
2. Verify Firestore rules and indexes
3. Test with Firebase emulators
4. Review user notification preferences
5. Check Expo push token validity

## Changelog

### v1.0.0

- Initial notification system implementation
- Daily caps and cooldown management
- Smart batching for friends posted and ratings
- Template variants for notification copy
- User preference management
- Cloud Functions for all notification logic
