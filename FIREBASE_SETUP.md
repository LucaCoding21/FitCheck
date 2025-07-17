# Firebase Setup Guide for FitCheck

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Name it "FitCheck" (or whatever you prefer)
4. Disable Google Analytics (not needed for MVP)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project, go to **Authentication** > **Sign-in method**
2. Click on **Email/Password**
3. Enable it and click **Save**

## Step 3: Create Firestore Database

1. Go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll update rules later)
4. Select your preferred location
5. Click **Done**

## Step 4: Enable Storage

1. Go to **Storage**
2. Click **Get started**
3. Choose **Start in test mode**
4. Select same location as Firestore
5. Click **Done**

## Step 5: Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click **Web app** icon (`</>`)
4. Register app name: "FitCheck"
5. Copy the `firebaseConfig` object

## Step 6: Update Your Code

Replace the config in `src/config/firebase.js`:

```javascript
const firebaseConfig = {
  // Paste your config here
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id",
};
```

## Step 7: Deploy Firestore Rules

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. In your project folder: `firebase init firestore`
4. Select your Firebase project
5. Use existing `firestore.rules` file
6. Deploy: `firebase deploy --only firestore:rules`

## Step 8: Test the App

```bash
npm start
```

## Troubleshooting

### "Missing or insufficient permissions"

- Make sure you deployed the Firestore rules
- Check that Authentication is enabled

### "The query requires an index"

- The app should work with our simplified queries
- If you see this error, click the provided link to auto-create the index

### Camera/Gallery not working

- Make sure you're testing on a physical device or simulator with camera access
- Web version won't have camera access

## Security Rules Explanation

The `firestore.rules` file contains:

- **Users**: Can only read/write their own user document
- **Groups**: Members can read, creators can update membership
- **Fits**: Only group members can see fits, only creators can post

This ensures privacy and security for your friend groups!
