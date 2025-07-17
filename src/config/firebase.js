import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace with your Firebase config from Firebase Console
// 1. Go to https://console.firebase.google.com
// 2. Create a new project or select existing
// 3. Go to Project Settings > General > Your apps
// 4. Add a web app and copy the config object
const firebaseConfig = {
  apiKey: "AIzaSyA9AIWCSgBza8TDZG2bHBudq0Y-k5KSaA0",
  authDomain: "fitcheck-28882.firebaseapp.com",
  projectId: "fitcheck-28882",
  storageBucket: "fitcheck-28882.firebasestorage.app",
  messagingSenderId: "1029973108831",
  appId: "1:1029973108831:web:ae5b5da255cae782c253ea"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;