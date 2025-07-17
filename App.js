import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import PostFitScreen from './src/screens/PostFitScreen';
import GroupScreen from './src/screens/GroupScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { theme } from './src/styles/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Custom Tab Bar Component
function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={{
      position: 'absolute',
      bottom: 25,
      left: 20,
      right: 20,
      height: 70,
      borderRadius: 25,
      overflow: 'hidden',
    }}>
      <LinearGradient
        colors={[theme.colors.surface, theme.colors.card]}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
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
                return focused ? '🏠' : '🏠';
              case 'PostFit':
                return '📸';
              case 'Groups':
                return focused ? '👥' : '👥';
              default:
                return '•';
            }
          };

          const getTabLabel = (routeName) => {
            switch (routeName) {
              case 'Home':
                return 'Feed';
              case 'PostFit':
                return 'Post';
              case 'Groups':
                return 'Groups';
              default:
                return routeName;
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
              }}
            >
              {isFocused && route.name !== 'PostFit' && (
                <LinearGradient
                  colors={theme.colors.primaryGradient}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 15,
                    opacity: 0.2,
                  }}
                />
              )}
              
              {route.name === 'PostFit' ? (
                <LinearGradient
                  colors={theme.colors.accentGradient}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{getTabIcon(route.name, isFocused)}</Text>
                </LinearGradient>
              ) : (
                <>
                  <Text style={{
                    fontSize: 24,
                    marginBottom: 2,
                    opacity: isFocused ? 1 : 0.6,
                  }}>
                    {getTabIcon(route.name, isFocused)}
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: isFocused ? theme.colors.text : theme.colors.textMuted,
                    fontWeight: isFocused ? '600' : '400',
                  }}>
                    {getTabLabel(route.name)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </LinearGradient>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="PostFit" component={PostFitScreen} />
      <Tab.Screen name="Groups" component={GroupScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  // const { user, loading } = useAuth();
  // if (loading) { ... }
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Onboarding">
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
