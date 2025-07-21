import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import { CommonActions } from '@react-navigation/native';
import notificationService from '../services/NotificationService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const navigationRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      
      // Initialize notifications when user signs in
      if (user) {
        try {
          const initialized = await notificationService.initialize();
          if (initialized) {
            await notificationService.savePushToken();
          }
        } catch (error) {
          console.error('Error initializing notifications:', error);
        }
      } else {
        // Clean up notifications when user signs out
        notificationService.cleanup();
      }
      
      // Remove automatic navigation - let the App.js handle navigation based on auth state
      // This prevents conflicts with MainNavigator's profile completion logic
    });

    return unsubscribe;
  }, []);

  const signOutUser = async () => {
    try {
      // Remove push token before signing out
      await notificationService.removePushToken();
      
      // Clear AsyncStorage to remove persisted auth state
      await AsyncStorage.clear();
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Reset context state
      setUser(null);
      setJustSignedUp(false);
      
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    justSignedUp,
    setJustSignedUp,
    signOutUser,
    setNavigationRef: (ref) => {
      navigationRef.current = ref;
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};