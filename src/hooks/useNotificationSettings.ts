import { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface NotificationPreferences {
  commentNotifications: boolean;
  ratingNotifications: boolean;
  newFitNotifications: boolean;
  postReminderNotifications: boolean;
  leaderboardNotifications: boolean;
  newMemberNotifications: boolean;
}

export function useNotificationSettings() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    commentNotifications: true,
    ratingNotifications: true,
    newFitNotifications: true,
    postReminderNotifications: true,
    leaderboardNotifications: true,
    newMemberNotifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences from Firestore
  const loadPreferences = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedPreferences = userData.notificationPreferences || {};
        
        setPreferences({
          commentNotifications: savedPreferences.commentNotifications !== false,
          ratingNotifications: savedPreferences.ratingNotifications !== false,
          newFitNotifications: savedPreferences.newFitNotifications !== false,
          postReminderNotifications: savedPreferences.postReminderNotifications !== false,
          leaderboardNotifications: savedPreferences.leaderboardNotifications !== false,
          newMemberNotifications: savedPreferences.newMemberNotifications !== false,
        });
      }
    } catch (err) {
      console.error('Error loading notification preferences:', err);
      setError('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  // Update a single preference
  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;

    try {
      setError(null);
      
      // Optimistically update local state
      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);

      // Update in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        notificationPreferences: newPreferences,
        updatedAt: new Date(),
      });

      console.log(`Notification preference updated: ${key} = ${value}`);
    } catch (err) {
      console.error('Error updating notification preference:', err);
      setError('Failed to update notification preference');
      
      // Revert the change on error
      setPreferences(prev => ({ ...prev, [key]: !value }));
    }
  };

  // Update multiple preferences at once
  const updateMultiplePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!user) return;

    try {
      setError(null);
      
      const newPreferences = { ...preferences, ...updates };
      setPreferences(newPreferences);

      await updateDoc(doc(db, 'users', user.uid), {
        notificationPreferences: newPreferences,
        updatedAt: new Date(),
      });

      console.log('Multiple notification preferences updated');
    } catch (err) {
      console.error('Error updating notification preferences:', err);
      setError('Failed to update notification preferences');
      
      // Revert changes on error
      setPreferences(prev => ({ ...prev }));
    }
  };

  // Reset preferences to defaults
  const resetPreferences = async () => {
    const defaults: NotificationPreferences = {
      commentNotifications: true,
      ratingNotifications: true,
      newFitNotifications: true,
      postReminderNotifications: true,
      leaderboardNotifications: true,
      newMemberNotifications: true,
    };

    await updateMultiplePreferences(defaults);
  };

  // Load preferences when user changes
  useEffect(() => {
    if (user) {
      loadPreferences();
    } else {
      setPreferences({
        commentNotifications: true,
        ratingNotifications: true,
        newFitNotifications: true,
        postReminderNotifications: true,
        leaderboardNotifications: true,
        newMemberNotifications: true,
      });
      setLoading(false);
    }
  }, [user]);

  return {
    preferences,
    loading,
    error,
    updatePreference,
    updateMultiplePreferences,
    resetPreferences,
    reloadPreferences: loadPreferences,
  };
} 