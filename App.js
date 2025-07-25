import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import MainNavigator from './src/navigation/MainNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import OnboardingScreen1 from './src/screens/OnboardingScreen1';
import OnboardingScreen2 from './src/screens/OnboardingScreen2';
import SignUpScreen from './src/screens/SignUpScreen';
import SignInScreen from './src/screens/SignInScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const Stack = createStackNavigator();

// Custom Toast config
const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: '#2A2A2A',
        borderLeftColor: 'transparent',
        borderRadius: 12,
        minHeight: 48,
        alignItems: 'center',
        shadowOpacity: 0,
        marginHorizontal: 16,
        marginBottom: 600,
        marginLeft: 50,
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
      }}
      text2Style={{ color: '#71717A' }}
      renderLeadingIcon={() => (
        <Ionicons name="checkmark-circle" size={22} color="#B5483D" style={{ marginRight: 8 }} />
      )}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        backgroundColor: '#2A2A2A',
        borderLeftColor: 'transparent',
        borderRadius: 12,
        minHeight: 48,
        alignItems: 'center',
        shadowOpacity: 0,
        marginHorizontal: 16,
        marginBottom: 400,
      }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      text1Style={{
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
      }}
      text2Style={{ color: '#71717A' }}
      renderLeadingIcon={() => (
        <Ionicons name="close-circle" size={22} color="#EF4444" style={{ marginRight: 8 }} />
      )}
    />
  ),
};

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
            <Stack.Screen name="OnboardingScreen1" component={OnboardingScreen1} />
            <Stack.Screen name="OnboardingScreen2" component={OnboardingScreen2} />
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
        <Toast config={toastConfig} />
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
