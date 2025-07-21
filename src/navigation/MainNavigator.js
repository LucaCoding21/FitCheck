import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Animated, Image } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import HomeScreen from '../screens/HomeScreen';
import PostFitScreen from '../screens/PostFitScreen';
import GroupScreen from '../screens/GroupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LeaderboardScreen from '../components/LeaderboardScreen';
import NoGroupsScreen from '../screens/NoGroupsScreen';
import FitDetailsScreen from '../screens/FitDetailsScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import GroupDetailsScreen from '../screens/GroupDetailsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Modern Tab Bar Component
function CustomTabBar({ state, descriptors, navigation }) {
  const { user } = useAuth();
  const [userProfileImageURL, setUserProfileImageURL] = useState(null);
  const scaleAnimations = useRef({}).current;

  useEffect(() => {
    if (user?.uid) {
      fetchUserProfile();
    }
  }, [user]);

  // Initialize scale animations for each tab
  useEffect(() => {
    state.routes.forEach((route) => {
      if (!scaleAnimations[route.key]) {
        scaleAnimations[route.key] = new Animated.Value(1);
      }
    });
  }, [state.routes]);

  // Handle animations when focus changes
  useEffect(() => {
    state.routes.forEach((route, index) => {
      const isFocused = state.index === index;
      animateIcon(route.key, isFocused);
    });
  }, [state.index]);

  const fetchUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfileImageURL(userData.profileImageURL || null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const animateIcon = (routeKey, isFocused) => {
    if (scaleAnimations[routeKey]) {
      const scaleValue = isFocused ? 1.2 : 1;
      Animated.spring(scaleAnimations[routeKey], {
        toValue: scaleValue,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <View style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      paddingBottom: 20,
      paddingTop: 10,
      paddingHorizontal: 16,
      elevation: 0,
      shadowOpacity: 0,
    }}>
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#060606',
        borderRadius: 35,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-around',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        minHeight: 60,
      }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Center button (PostFit) - Circular red button
          if (route.name === 'PostFit') {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -10,
                  width: 56,
                  height: 56,
                }}
              >
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: '#B5483D',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}>
                  <Text style={{ 
                    fontSize: 24, 
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    lineHeight: 24,
                  }}>
                    +
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }

          // Side buttons with PNG icons
          const getTabIcon = (routeName) => {
            switch (routeName) {
              case 'Home':
                return require('../../assets/Home.png');
              case 'Leaderboard':
                return require('../../assets/Leaderboard.png');
              case 'Groups':
                return require('../../assets/Friends.png');
              default:
                return null;
            }
          };

          // Profile tab with user's profile picture
          if (route.name === 'Profile') {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 8,
                  minHeight: 44,
                }}
              >
                <Animated.View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  overflow: 'hidden',
                  marginBottom: 4,
                  borderWidth: isFocused ? 2 : 0,
                  borderColor: '#FFFFFF',
                  transform: [{ scale: scaleAnimations[route.key] || 1 }],
                }}>
                  {userProfileImageURL ? (
                    <OptimizedImage
                      source={{ uri: userProfileImageURL }}
                      style={{
                        width: '100%',
                        height: '100%',
                      }}
                      showLoadingIndicator={false}
                    />
                  ) : (
                    <View style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#666666',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 16 }}>👤</Text>
                    </View>
                  )}
                </Animated.View>
                <Text style={{
                  fontSize: 12,
                  color: '#FFFFFF',
                  fontWeight: isFocused ? '600' : '400',
                }}>
                  Profile
                </Text>
              </TouchableOpacity>
            );
          }

          // Other tabs with PNG icons
          return (
                          <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 8,
                  minHeight: 44,
                }}
              >
              <Animated.View style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
                transform: [{ scale: scaleAnimations[route.key] || 1 }],
              }}>
                <Image
                  source={getTabIcon(route.name)}
                  style={{
                    width: 24,
                    height: 24,
                    tintColor: '#FFFFFF',
                    opacity: isFocused ? 1 : 0.7,
                  }}
                  resizeMode="contain"
                />
              </Animated.View>
              <Text style={{
                fontSize: 12,
                color: '#FFFFFF',
                fontWeight: isFocused ? '600' : '400',
              }}>
                {route.name === 'Home' ? 'Home' : 
                 route.name === 'Leaderboard' ? 'Leaderboard' : 
                 route.name === 'Groups' ? 'Groups' : route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs({ route }) {
  const selectedGroup = route?.params?.selectedGroup;
  
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ 
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarBackground: () => null,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        initialParams={{ selectedGroup }}
      />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="PostFit" component={PostFitScreen} />
      <Tab.Screen name="Groups" component={GroupScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function MainNavigator({ route }) {
  const { user, justSignedUp } = useAuth();
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const selectedGroup = route?.params?.selectedGroup;

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
      fetchUserGroups();
    } else if (!user) {
      setLoading(false);
    }
  }, [user]);

  // Add effect to refresh user data when justSignedUp changes
  useEffect(() => {
    if (user?.uid && !justSignedUp) {
      fetchUserData();
    }
  }, [justSignedUp, user]);

  // Refresh groups when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.uid) {
        fetchUserData();
        fetchUserGroups();
      }
    }, [user])
  );

  const fetchUserData = async () => {
    if (!user?.uid) {
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
      } else {
        // If user document doesn't exist, set empty object to prevent infinite loading
        setUserData({});
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Set empty object on error to prevent infinite loading
      setUserData({});
    }
  };

  const fetchUserGroups = async () => {
    if (!user?.uid) {
      return;
    }

    try {
      const groupsQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(groupsQuery);
      const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserGroups(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B5483D" />
      </View>
    );
  }

  // Check if profile is completed
  // For new users (justSignedUp), always show ProfileSetup
  // For returning users, check if profile is completed
  const shouldShowProfileSetup = justSignedUp || (userData && userData.profileCompleted !== true);
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {shouldShowProfileSetup ? (
        // Profile not completed - show ProfileSetup
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      ) : userGroups.length === 0 ? (
        // No groups - show screens without tab bar
        <>
          <Stack.Screen name="NoGroups" component={NoGroupsScreen} />
          <Stack.Screen name="Groups" component={GroupScreen} />
          <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="FitDetails" component={FitDetailsScreen} />
        </>
      ) : (
        // Has groups - show MainTabs with tab bar
        <>
          <Stack.Screen 
            name="MainTabs" 
            component={MainTabs}
            initialParams={{ selectedGroup }}
          />
          <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
          <Stack.Screen name="FitDetails" component={FitDetailsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MainNavigator; 