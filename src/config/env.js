// Environment configuration for FitCheck
// This file handles environment variables for the app

const ENV = {
  development: {
    FIREBASE_API_KEY: "AIzaSyA9AIWCSgBza8TDZG2bHBudq0Y-k5KSaA0",
    FIREBASE_AUTH_DOMAIN: "fitcheck-28882.firebaseapp.com",
    FIREBASE_PROJECT_ID: "fitcheck-28882",
    FIREBASE_STORAGE_BUCKET: "fitcheck-28882.firebasestorage.app",
    FIREBASE_MESSAGING_SENDER_ID: "1029973108831",
    FIREBASE_APP_ID: "1:1029973108831:web:ae5b5da255cae782c253ea",
  },
  production: {
    FIREBASE_API_KEY: "AIzaSyA9AIWCSgBza8TDZG2bHBudq0Y-k5KSaA0",
    FIREBASE_AUTH_DOMAIN: "fitcheck-28882.firebaseapp.com",
    FIREBASE_PROJECT_ID: "fitcheck-28882",
    FIREBASE_STORAGE_BUCKET: "fitcheck-28882.firebasestorage.app",
    FIREBASE_MESSAGING_SENDER_ID: "1029973108831",
    FIREBASE_APP_ID: "1:1029973108831:web:ae5b5da255cae782c253ea",
  },
};

// Get the environment based on __DEV__ flag
const getEnvVars = () => {
  if (__DEV__) {
    return ENV.development;
  }
  return ENV.production;
};

export default getEnvVars(); 