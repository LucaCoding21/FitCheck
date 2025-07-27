import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Switch,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const DataSection = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>
      {children}
    </View>
  </View>
);

const DataItem = ({ icon, title, subtitle, onPress, showArrow = true, showSwitch = false, switchValue, onSwitchChange }) => (
  <TouchableOpacity
    style={styles.dataItem}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.dataItemLeft}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.dataItemTitle}>{title}</Text>
        {subtitle && (
          <Text style={styles.dataItemSubtitle}>{subtitle}</Text>
        )}
      </View>
    </View>
    {showSwitch ? (
      <Switch
        value={switchValue}
        onValueChange={onSwitchChange}
        trackColor={{ false: '#3a3a3a', true: theme.colors.primary }}
        thumbColor={switchValue ? '#ffffff' : '#f4f3f4'}
      />
    ) : showArrow && (
      <Ionicons name="chevron-forward" size={20} color="#666666" />
    )}
  </TouchableOpacity>
);

export default function DataManagementScreen({ navigation }) {
  const { user, signOutUser } = useAuth();
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConsentChange = async (type, value) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        [`consent.${type}`]: value,
        updatedAt: new Date(),
      });
      
      setAnalyticsConsent(value);
    } catch (error) {
      console.error('Error updating consent:', error);
      Alert.alert('Error', 'Failed to update consent settings');
    }
  };

  const handleAccountDeletion = async () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data including fits, comments, ratings, and group memberships will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Account', 
          style: 'destructive',
          onPress: () => confirmAccountDeletion()
        },
      ]
    );
  };

  const confirmAccountDeletion = () => {
    Alert.alert(
      'Final Confirmation',
      'Are you absolutely sure? This will permanently delete your account and all associated data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Delete Everything', 
          style: 'destructive',
          onPress: performAccountDeletion
        },
      ]
    );
  };

  const performAccountDeletion = async () => {
    setIsDeleting(true);
    try {
      // Delete user's fits
      const fitsQuery = query(collection(db, 'fits'), where('userId', '==', user.uid));
      const fitsSnapshot = await getDocs(fitsQuery);
      const fitDeletions = fitsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(fitDeletions);

      // Delete user's comments
      const commentsQuery = query(collection(db, 'comments'), where('userId', '==', user.uid));
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentDeletions = commentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(commentDeletions);

      // Delete user's ratings
      const ratingsQuery = query(collection(db, 'ratings'), where('userId', '==', user.uid));
      const ratingsSnapshot = await getDocs(ratingsQuery);
      const ratingDeletions = ratingsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(ratingDeletions);

      // Remove user from groups
      const groupsQuery = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupUpdates = groupsSnapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          members: doc.data().members.filter(memberId => memberId !== user.uid)
        })
      );
      await Promise.all(groupUpdates);

      // Delete user document
      await deleteDoc(doc(db, 'users', user.uid));

      Alert.alert(
        'Account Deleted',
        'Your account and all data have been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await signOutUser();
              navigation.reset({
                index: 0,
                routes: [{ name: 'SignIn' }],
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openPrivacyPolicy = async () => {
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
        <Text style={styles.headerTitle}>Data & Privacy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Data Collection Disclosure */}
        <DataSection title="Data Collection">
          <DataItem
            icon="camera-outline"
            title="Photos & Content"
            subtitle="Your outfit photos, captions, and comments"
            onPress={() => {}}
            showArrow={false}
          />
          <DataItem
            icon="people-outline"
            title="Social Data"
            subtitle="Group memberships, ratings, and interactions"
            onPress={() => {}}
            showArrow={false}
          />
          <DataItem
            icon="analytics-outline"
            title="Usage Analytics"
            subtitle="App usage patterns and performance data"
            onPress={() => {}}
            showArrow={false}
          />
          <DataItem
            icon="notifications-outline"
            title="Device Information"
            subtitle="Device type, OS version, and push tokens"
            onPress={() => {}}
            showArrow={false}
          />
        </DataSection>

        {/* User Consent */}
        <DataSection title="Data Usage Consent">
          <DataItem
            icon="analytics-outline"
            title="Analytics & Performance"
            subtitle="Help us improve the app"
            showSwitch={true}
            switchValue={analyticsConsent}
            onSwitchChange={(value) => handleConsentChange('analytics', value)}
          />
          <DataItem
            icon="shield-outline"
            title="Privacy Policy"
            subtitle="Read our complete privacy policy"
            onPress={openPrivacyPolicy}
          />
        </DataSection>

        {/* Data Management */}
        <DataSection title="Data Management">
          <DataItem
            icon="trash-outline"
            title="Delete Account"
            subtitle="Permanently delete all your data"
            onPress={handleAccountDeletion}
          />
        </DataSection>

        {/* Information */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Your data is stored securely using Firebase (Google Cloud). You can control your data usage and request deletion at any time.
          </Text>
        </View>
      </ScrollView>

      {isDeleting && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Deleting account...</Text>
        </View>
      )}
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
  section: {
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
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  dataItemLeft: {
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
  dataItemTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  dataItemSubtitle: {
    fontSize: 14,
    color: '#AAAAAA',
    lineHeight: 20,
  },
  infoContainer: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: 'rgba(181, 72, 61, 0.1)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#B5483D',
  },
  infoText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 