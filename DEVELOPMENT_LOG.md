# FitCheck Development Log (Trimmed)

## 🧥 FitCheck — App Overview & Philosophy

FitCheck is a mobile-first app built with React Native (Expo) and Firebase, designed for small friend groups to post and rate daily outfits in a private, brutally honest, and competitive space.

It's like BeReal meets RateMyProfessor, but for fashion—and just among your crew.

### 📱 Core Concept

Users create or join private fit groups, where they can:

- Post one fit (outfit) per day
- Upload a photo from camera or gallery
- Add a caption and tag (e.g. "casual", "school")
- Fits are visible to group members only
- Rate other fits in the group (5-star, anonymous by default)
- Compete on the Daily Leaderboard (ranks by average fit rating, resets daily)
- Leave and receive comments (public within group, notification center)

### 🧠 App Philosophy

FitCheck is designed for:

- Style accountability within real friend groups
- Honest feedback, not social clout
- Building daily rituals around self-expression

The vibe is raw, private, and personal—not polished like Instagram, not public like TikTok.

### ⚙️ Tech Stack

- **Frontend**: React Native (Expo)
- **Backend**: Firebase
- **Auth**: Firebase Authentication
- **Database**: Firestore
- **Image Upload**: Firebase Storage
- **Styling**: Custom CSS
- **State Management**: React Context + Hooks

---

## 🔥 **FIREBASE DATABASE ENCYCLOPEDIA**

### **Database Structure & Key Variables**

#### **Collections Overview**

**1. `users` Collection**

- Document ID: User's Firebase Auth UID
- Fields: username, email, profileImageURL, profileCompleted, createdAt, updatedAt, groups (array of group IDs), readNotificationIds, pushToken, notificationPreferences (object)

**2. `fits` Collection**

- Document ID: Auto-generated
- Fields: userId, userName, userEmail, userProfileImageURL, imageURL, caption, tag, createdAt, lastUpdated, groupIds (array), ratingCount, fairRating, ratings (object), comments (array)

**3. `groups` Collection**

- Document ID: Auto-generated
- Fields: name, description, createdBy, createdAt, members (array of UIDs), memberCount

**4. `notifications` Collection**

- Document ID: Auto-generated
- Fields: userId, type ('comment', 'rating', 'new_fit', 'general'), title, body, data (object), read, createdAt

#### **Key Variables for Data Access**

- `user.uid` — Current user's Firebase Auth UID
- `fit.id` — Fit document ID
- `group.id` — Group document ID
- `notification.type` — Type of notification

#### **Common Data Queries**

- Get user's fits: `where("userId", "==", user.uid)`
- Get group's fits: `where("groupIds", "array-contains", groupId)`
- Get today's fits: `where("createdAt", ">=", today), where("createdAt", "<", tomorrow)`
- Get user profile: `getDoc(doc(db, "users", user.uid))`
- Get user's notifications: `where("userId", "==", user.uid)`

#### **Data Update Patterns**

- Add rating: `updateDoc(doc(db, "fits", fitId), { [\`ratings.${user.uid}\`]: { rating, timestamp }, ... })`
- Add comment: `updateDoc(doc(db, "fits", fitId), { comments: arrayUnion({ ... }) })`
- Update user profile: `updateDoc(doc(db, "users", user.uid), { ... })`
- Update notification preferences: `updateDoc(doc(db, "users", user.uid), { notificationPreferences: { ... } })`

#### **Important Notes**

1. Always use `imageURL` (capital "URL")
2. Use `fit.ratings[user.uid]` for current user's rating
3. Use `.toDate()` for Firestore timestamps
4. Use `array-contains` for array fields
5. User documents use `groups` (not `groupIds`)
6. Group documents use `members` (not `memberIds`)
7. Use `onSnapshot` for real-time updates
8. Always wrap Firebase operations in try-catch
9. Check notification preferences before sending
10. Store Expo push tokens for notifications

---

## 📝 High-Level Context & Motivation

- FitCheck is for real friends, not followers.
- The app is intentionally private, honest, and competitive.
- All features are designed to encourage daily participation and authentic feedback.
- No global feed, no DMs, no public profiles—just your group.
- Leaderboards and notifications are tuned for engagement, not spam.
- Firebase structure is optimized for real-time updates and group-based privacy.

---

## (Changelog, UI tweaks, and detailed implementation logs have been trimmed for brevity and future clarity.)

## [Feature] PostFitScreen: Auto-navigate, Toast, and Haptic

- After posting a fit, user is sent to HomeScreen (feed)
- A toast (not alert) confirms the fit is posted
- Phone vibrates (haptic feedback) on post
- Feed scrolls to top

## [Fix] PostFitScreen: Navigation to Home tab after posting

- Fixed navigation bug after posting a fit ("The action 'NAVIGATE' with payload {name: 'Home'} was not handled by any navigator.")
- Now uses navigation.navigate('MainTabs', { screen: 'Home', params: { showPostToast: true } }) to correctly show the Home tab and toast.
