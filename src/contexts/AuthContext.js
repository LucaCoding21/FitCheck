import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { CommonActions } from '@react-navigation/native';

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      // Remove automatic navigation - let the App.js handle navigation based on auth state
      // This prevents conflicts with MainNavigator's profile completion logic
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    loading,
    justSignedUp,
    setJustSignedUp,
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