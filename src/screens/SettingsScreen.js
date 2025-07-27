import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';

const SettingsItem = ({ icon, title, subtitle, onPress, showArrow = true }) => (
  <TouchableOpacity
    style={styles.settingsItem}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.settingsItemLeft}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.settingsItemTitle}>{title}</Text>
        {subtitle && (
          <Text style={styles.settingsItemSubtitle}>{subtitle}</Text>
        )}
      </View>
    </View>
    {showArrow && (
      <Ionicons name="chevron-forward" size={20} color="#666666" />
    )}
  </TouchableOpacity>
);

const SettingsSection = ({ title, children }) => (
  <View style={styles.settingsSection}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>
      {children}
    </View>
  </View>
);



export default function SettingsScreen({ navigation }) {
  const { signOutUser } = useAuth();
  
  const handleComingSoon = (feature) => {
    Alert.alert(
      'Coming Soon',
      `${feature} will be available in a future update!`,
      [{ text: 'OK', style: 'default' }]
    );
  };

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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Notifications Section */}
        <SettingsSection title="Notifications">
          <SettingsItem
            icon="notifications-outline"
            title="Notification Preferences"
            subtitle="Manage all your notification settings"
            onPress={() => navigation.navigate('NotificationPreferences')}
          />
        </SettingsSection>

        {/* Privacy & Security Section */}
        <SettingsSection title="Privacy & Security">
          <SettingsItem
            icon="shield-outline"
            title="Privacy Policy"
            subtitle="Read our privacy policy"
            onPress={async () => {
              try {
                const url = 'https://fitcheck-landingpage.vercel.app/privacy';
                const supported = await Linking.canOpenURL(url);
                
                if (supported) {
                  await Linking.openURL(url);
                } else {
                  Alert.alert('Error', 'Cannot open this URL');
                }
              } catch (error) {
                console.error('Error opening URL:', error);
                Alert.alert('Error', 'Failed to open privacy policy');
              }
            }}
          />
          <SettingsItem
            icon="document-text-outline"
            title="Terms of Service"
            subtitle="Read our terms of service"
            onPress={async () => {
              try {
                const url = 'https://fitcheck-landingpage.vercel.app/terms';
                const supported = await Linking.canOpenURL(url);
                
                if (supported) {
                  await Linking.openURL(url);
                } else {
                  Alert.alert('Error', 'Cannot open this URL');
                }
              } catch (error) {
                console.error('Error opening URL:', error);
                Alert.alert('Error', 'Failed to open terms of service');
              }
            }}
          />
          <SettingsItem
            icon="lock-closed-outline"
            title="Data & Privacy"
            subtitle="Manage your data and privacy settings"
            onPress={() => navigation.navigate('DataManagement')}
          />
        </SettingsSection>

        {/* App Store Requirements Section */}
        <SettingsSection title="App Information">
          <SettingsItem
            icon="information-circle-outline"
            title="About FitCheck"
            subtitle="Version 1.0.0"
            onPress={() => handleComingSoon('About FitCheck')}
          />
          <SettingsItem
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Get help and contact support"
            onPress={() => handleComingSoon('Help & Support')}
          />
          <SettingsItem
            icon="star-outline"
            title="Rate FitCheck"
            subtitle="Rate us on the App Store"
            onPress={() => handleComingSoon('App Store Rating')}
          />
          <SettingsItem
            icon="share-outline"
            title="Share FitCheck"
            subtitle="Share with friends"
            onPress={() => handleComingSoon('Share FitCheck')}
          />
        </SettingsSection>

        {/* Legal Section */}
        <SettingsSection title="Legal">
          <SettingsItem
            icon="document-outline"
            title="Licenses"
            subtitle="Open source licenses"
            onPress={() => handleComingSoon('Open Source Licenses')}
          />
          <SettingsItem
            icon="shield-checkmark-outline"
            title="Data Processing"
            subtitle="How we process your data"
            onPress={() => handleComingSoon('Data Processing Information')}
          />
        </SettingsSection>

        {/* Account Section */}
        <SettingsSection title="Account">
          <SettingsItem
            icon="log-out-outline"
            title="Sign Out"
            subtitle="Sign out of your account"
            onPress={() => {
              Alert.alert(
                'Sign Out',
                'Are you sure you want to sign out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Sign Out', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await signOutUser();
                      } catch (error) {
                        console.error('Error signing out:', error);
                        Alert.alert('Error', 'Failed to sign out. Please try again.');
                      }
                    }
                  },
                ]
              );
            }}
          />
        </SettingsSection>
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
    paddingBottom: 40,
  },
  settingsSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#B5483D',
    marginBottom: 8,
    paddingHorizontal: 20,
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: '#2A2A2A',
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(181, 72, 61, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  settingsItemSubtitle: {
    fontSize: 14,
    color: '#AAAAAA',
    lineHeight: 20,
  },
}); 