import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

export default function NotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    commentNotifications: true,
    ratingNotifications: true,
    newFitNotifications: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedPreferences = userData.notificationPreferences || {};
        
        setPreferences({
          commentNotifications: savedPreferences.commentNotifications !== false,
          ratingNotifications: savedPreferences.ratingNotifications !== false,
          newFitNotifications: savedPreferences.newFitNotifications !== false,
        });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key, value) => {
    if (!user) return;

    try {
      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);

      await updateDoc(doc(db, 'users', user.uid), {
        notificationPreferences: newPreferences,
        updatedAt: new Date(),
      });

      console.log(`Notification preference updated: ${key} = ${value}`);
    } catch (error) {
      console.error('Error updating notification preference:', error);
      Alert.alert('Error', 'Failed to update notification preference. Please try again.');
      // Revert the change on error
      setPreferences(prev => ({ ...prev, [key]: !value }));
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Settings</Text>
      <Text style={styles.subtitle}>Choose which notifications you want to receive</Text>

      <View style={styles.preferencesContainer}>
        {/* Comment Notifications */}
        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>Comments</Text>
            <Text style={styles.preferenceDescription}>
              When someone comments on your fits
            </Text>
          </View>
          <Switch
            value={preferences.commentNotifications}
            onValueChange={(value) => updatePreference('commentNotifications', value)}
            trackColor={{ false: '#3a3a3a', true: theme.colors.primary }}
            thumbColor={preferences.commentNotifications ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        {/* Rating Notifications */}
        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>Ratings</Text>
            <Text style={styles.preferenceDescription}>
              When someone rates your fit (anonymous)
            </Text>
          </View>
          <Switch
            value={preferences.ratingNotifications}
            onValueChange={(value) => updatePreference('ratingNotifications', value)}
            trackColor={{ false: '#3a3a3a', true: theme.colors.primary }}
            thumbColor={preferences.ratingNotifications ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        {/* New Fit Notifications */}
        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Text style={styles.preferenceTitle}>New Fits</Text>
            <Text style={styles.preferenceDescription}>
              When someone in your group posts a fit
            </Text>
          </View>
          <Switch
            value={preferences.newFitNotifications}
            onValueChange={(value) => updatePreference('newFitNotifications', value)}
            trackColor={{ false: '#3a3a3a', true: theme.colors.primary }}
            thumbColor={preferences.newFitNotifications ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          💡 You can change these settings anytime. Changes take effect immediately.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#71717A',
    marginBottom: 32,
  },
  preferencesContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#71717A',
    lineHeight: 20,
  },
  infoContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  infoText: {
    fontSize: 14,
    color: '#71717A',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 40,
  },
}); 