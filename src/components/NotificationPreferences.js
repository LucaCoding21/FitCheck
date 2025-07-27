import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { theme } from '../styles/theme';

export default function NotificationPreferences({ navigation }) {
  const {
    preferences,
    loading,
    error,
    updatePreference,
  } = useNotificationSettings();

  const handlePreferenceChange = async (key, value) => {
    try {
      await updatePreference(key, value);
    } catch (error) {
      Alert.alert('Error', 'Failed to update notification preference. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
              onValueChange={(value) => handlePreferenceChange('commentNotifications', value)}
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
              onValueChange={(value) => handlePreferenceChange('ratingNotifications', value)}
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
              onValueChange={(value) => handlePreferenceChange('newFitNotifications', value)}
              trackColor={{ false: '#3a3a3a', true: theme.colors.primary }}
              thumbColor={preferences.newFitNotifications ? '#ffffff' : '#f4f3f4'}
            />
          </View>

          {/* Post Reminder Notifications */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>Daily Reminders</Text>
              <Text style={styles.preferenceDescription}>
                Reminders to post your daily fit
              </Text>
            </View>
            <Switch
              value={preferences.postReminderNotifications}
              onValueChange={(value) => handlePreferenceChange('postReminderNotifications', value)}
              trackColor={{ false: '#3a3a3a', true: theme.colors.primary }}
              thumbColor={preferences.postReminderNotifications ? '#ffffff' : '#f4f3f4'}
            />
          </View>

          {/* Leaderboard Notifications */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>Leaderboard Results</Text>
              <Text style={styles.preferenceDescription}>
                Daily winner announcements and resets
              </Text>
            </View>
            <Switch
              value={preferences.leaderboardNotifications}
              onValueChange={(value) => handlePreferenceChange('leaderboardNotifications', value)}
              trackColor={{ false: '#3a3a3a', true: theme.colors.primary }}
              thumbColor={preferences.leaderboardNotifications ? '#ffffff' : '#f4f3f4'}
            />
          </View>

          {/* New Member Notifications */}
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>New Members</Text>
              <Text style={styles.preferenceDescription}>
                When someone joins your group
              </Text>
            </View>
            <Switch
              value={preferences.newMemberNotifications}
              onValueChange={(value) => handlePreferenceChange('newMemberNotifications', value)}
              trackColor={{ false: '#3a3a3a', true: theme.colors.primary }}
              thumbColor={preferences.newMemberNotifications ? '#ffffff' : '#f4f3f4'}
            />
          </View>
        </View>



        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            💡 You can change these settings anytime. Changes take effect immediately.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
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