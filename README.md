# FitCheck 🧥

A private, fun, mobile-first app where you and your friends post outfits, rate each other's fits, and compete for daily bragging rights.

## Features

- 📸 **Daily Fit Posts**: Take photos or upload from gallery
- 👥 **Private Groups**: Invite-only groups (max 20 members)
- 🔥 **Emoji Ratings**: Rate fits with Fire/Mid/Trash emojis
- 🏆 **Live Leaderboards**: See who has the best fits
- 📱 **Mobile-First**: Built with React Native & Expo

## Setup

### 1. Install Dependencies

```bash
cd FitCheck
npm install
```

### 2. Firebase Setup

1. Create a new Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Enable Storage
5. Copy your Firebase config and update `src/config/firebase.js`

### 3. Run the App

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run in web browser
npm run web
```

## How to Use

1. **Sign Up/Sign In**: Create an account or sign in
2. **Create/Join Group**: Create a new group or join with a group code
3. **Post Fits**: Take a photo and add caption/tags
4. **Rate Friends**: Use emoji reactions to rate others' fits
5. **Check Leaderboard**: See who's winning the fit game

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Navigation**: React Navigation
- **Camera**: Expo Camera & Image Picker

## Project Structure

```
src/
├── components/
│   └── FitCard.js          # Individual fit display component
├── config/
│   └── firebase.js         # Firebase configuration
├── contexts/
│   └── AuthContext.js      # Authentication context
└── screens/
    ├── AuthScreen.js       # Login/signup
    ├── HomeScreen.js       # Main feed
    ├── PostFitScreen.js    # Post new fits
    └── GroupScreen.js      # Group management
```

## Firebase Collections

### users

```javascript
{
  name: string,
  email: string,
  createdAt: timestamp,
  groups: array
}
```

### groups

```javascript
{
  name: string,
  code: string,
  createdBy: string,
  members: array,
  memberCount: number,
  createdAt: timestamp
}
```

### fits

```javascript
{
  userId: string,
  groupId: string,
  imageUrl: string,
  caption: string,
  tag: string,
  createdAt: timestamp,
  ratings: object,
  averageRating: number,
  ratingCount: number
}
```

## Next Steps (Future Features)

- 📊 Weekly/monthly leaderboards
- 🏆 Achievement badges
- 📱 Push notifications for daily recaps
- 👤 User profiles with fit history
- 🎯 Fit challenges and themes
