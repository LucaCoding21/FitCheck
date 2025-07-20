import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import MainNavigator from './src/navigation/MainNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import SignInScreen from './src/screens/SignInScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';

const Stack = createStackNavigator();

function AppNavigator() {
  const navigationRef = useRef(null);
  const { user, loading, setNavigationRef } = useAuth();

  React.useEffect(() => {
    if (navigationRef.current && setNavigationRef) {
      setNavigationRef(navigationRef.current);
    }
  }, [setNavigationRef]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B5483D" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // User is not authenticated - show auth screens
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="SignIn" component={SignInScreen} />
          </>
        ) : (
          // User is authenticated - show main app (including ProfileSetup if needed)
          <Stack.Screen 
            name="Main" 
            component={MainNavigator}
            options={{
              gestureEnabled: false,
              gestureDirection: 'horizontal',
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </GestureHandlerRootView>
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
