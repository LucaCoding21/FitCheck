import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import HomeScreen from '../screens/HomeScreen';
import PostFitScreen from '../screens/PostFitScreen';
import GroupScreen from '../screens/GroupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LeaderboardScreen from '../components/LeaderboardScreen';
import NoGroupsScreen from '../screens/NoGroupsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Modern Tab Bar Component
function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: '#E5E5E5',
      paddingBottom: 20,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 8,
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

        const getTabIcon = (routeName, focused) => {
          switch (routeName) {
            case 'Home':
              return '🏠';
            case 'PostFit':
              return '+';
            case 'Leaderboard':
              return '🏆';
            case 'Groups':
              return '👥';
            case 'Profile':
              return '👤';
            default:
              return '•';
          }
        };

        const getTabLabel = (routeName) => {
          switch (routeName) {
            case 'Home':
              return 'Home';
            case 'PostFit':
              return 'Post';
            case 'Leaderboard':
              return 'Top';
            case 'Groups':
              return 'Group';
            case 'Profile':
              return 'Profile';
            default:
              return routeName;
          }
        };

        // Center button (PostFit) - Elevated design
        if (route.name === 'PostFit') {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -20,
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
                }}>
                  {getTabIcon(route.name, isFocused)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }

        // Side buttons (Home, Leaderboard, and Groups)
        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 8,
            }}
          >
            <Text style={{
              fontSize: 24,
              marginBottom: 4,
              opacity: isFocused ? 1 : 0.6,
            }}>
              {getTabIcon(route.name, isFocused)}
            </Text>
            <Text style={{
              fontSize: 12,
              color: isFocused ? '#B5483D' : '#666666',
              fontWeight: isFocused ? '600' : '400',
            }}>
              {getTabLabel(route.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs({ route }) {
  const selectedGroup = route?.params?.selectedGroup;
  
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
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
  const { user } = useAuth();
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const selectedGroup = route?.params?.selectedGroup;

  useEffect(() => {
    if (user) {
      fetchUserGroups();
    }
  }, [user]);

  // Refresh groups when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchUserGroups();
      }
    }, [user])
  );

  const fetchUserGroups = async () => {
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B5483D" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userGroups.length === 0 ? (
        // No groups - show screens without tab bar
        <>
          <Stack.Screen name="NoGroups" component={NoGroupsScreen} />
          <Stack.Screen name="Groups" component={GroupScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      ) : (
        // Has groups - show MainTabs with tab bar
        <Stack.Screen 
          name="MainTabs" 
          component={MainTabs}
          initialParams={{ selectedGroup }}
        />
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