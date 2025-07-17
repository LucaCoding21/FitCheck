import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { theme } from "../styles/theme";

const { width, height } = Dimensions.get("window");

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const inputFocusAnim = useRef(new Animated.Value(0)).current;

  // Refs for input focus management
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Keyboard listeners for better handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      // Ensure form is visible when keyboard appears
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    return () => {
      keyboardDidShowListener?.remove();
    };
  }, []);

  // Handle input focus with animation and scroll
  const handleInputFocus = (inputName) => {
    setFocusedInput(inputName);
    Animated.timing(inputFocusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    
    // Scroll to ensure input is visible when keyboard appears
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 300);
  };

  const handleInputBlur = () => {
    setFocusedInput(null);
    Animated.timing(inputFocusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // Handle keyboard dismiss
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Handle next input navigation
  const handleNextInput = (currentField) => {
    switch (currentField) {
      case "name":
        emailInputRef.current?.focus();
        break;
      case "email":
        passwordInputRef.current?.focus();
        break;
      case "password":
        handleAuth();
        break;
    }
  };

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && !name)) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    dismissKeyboard();
    setLoading(true);
    
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name,
          email,
          createdAt: new Date(),
          groups: [],
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
    setLoading(false);
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setEmail("");
    setPassword("");
    setName("");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.background}
      />
        <LinearGradient
          colors={[theme.colors.background, theme.colors.surface]}
          style={styles.container}
        >
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              keyboardDismissMode="interactive"
            >
              {/* Animated Hero Section */}
              <Animated.View 
                style={[
                  styles.heroSection,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }
                ]}
              >
                {/* Floating Background Elements */}
                <View style={styles.floatingElements}>
                  <View style={[styles.floatingCircle, styles.circle1]} />
                  <View style={[styles.floatingCircle, styles.circle2]} />
                  <View style={[styles.floatingCircle, styles.circle3]} />
                </View>

                {/* Logo Container */}
                <Animated.View 
                  style={[
                    styles.logoContainer,
                    { transform: [{ scale: logoScale }] }
                  ]}
                >
                  <LinearGradient
                    colors={theme.colors.primaryGradient}
                    style={styles.logoGradient}
                  >
                    <Text style={styles.logoEmoji}>🧥</Text>
                  </LinearGradient>
                  <View style={styles.logoGlow} />
                </Animated.View>

                <Text style={styles.title}>FitCheck</Text>
                <Text style={styles.subtitle}>
                  {isSignUp ? "Join the crew" : "Welcome back"}
                </Text>
                <Text style={styles.description}>
                  {isSignUp 
                    ? "Create your account and start rating fits with friends"
                    : "Sign in to continue rating fits with your crew"
                  }
                </Text>
              </Animated.View>

              {/* Animated Form Section */}
              <Animated.View 
                style={[
                  styles.formSection,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }
                ]}
              >
                <View style={styles.formContainer}>
                  {/* Form Card */}
                  <View style={styles.formCard}>
                    <LinearGradient
                      colors={[theme.colors.card, theme.colors.surface]}
                      style={styles.formCardGradient}
                    >
                      {isSignUp && (
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Name</Text>
                          <View style={[
                            styles.inputWrapper,
                            focusedInput === 'name' && styles.inputWrapperFocused
                          ]}>
                            <TextInput
                              ref={nameInputRef}
                              style={styles.input}
                              placeholder="Enter your name"
                              placeholderTextColor={theme.colors.textMuted}
                              value={name}
                              onChangeText={setName}
                              returnKeyType="next"
                              onFocus={() => handleInputFocus('name')}
                              onBlur={handleInputBlur}
                              onSubmitEditing={() => handleNextInput("name")}
                            />
                          </View>
                        </View>
                      )}

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <View style={[
                          styles.inputWrapper,
                          focusedInput === 'email' && styles.inputWrapperFocused
                        ]}>
                          <TextInput
                            ref={emailInputRef}
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor={theme.colors.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            returnKeyType="next"
                            onFocus={() => handleInputFocus('email')}
                            onBlur={handleInputBlur}
                            onSubmitEditing={() => handleNextInput("email")}
                          />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Password</Text>
                        <View style={[
                          styles.inputWrapper,
                          focusedInput === 'password' && styles.inputWrapperFocused
                        ]}>
                          <TextInput
                            ref={passwordInputRef}
                            style={styles.input}
                            placeholder="Enter your password"
                            placeholderTextColor={theme.colors.textMuted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            returnKeyType="done"
                            onFocus={() => handleInputFocus('password')}
                            onBlur={handleInputBlur}
                            onSubmitEditing={() => handleNextInput("password")}
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.button}
                        onPress={handleAuth}
                        disabled={loading}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={
                            loading
                              ? [theme.colors.textMuted, theme.colors.textMuted]
                              : theme.colors.accentGradient
                          }
                          style={styles.buttonGradient}
                        >
                          <Text style={styles.buttonText}>
                            {loading
                              ? "Loading..."
                              : isSignUp
                              ? "Create Account"
                              : "Sign In"}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>

                  {/* Switch Mode Button */}
                  <TouchableOpacity
                    onPress={toggleAuthMode}
                    style={styles.switchButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.switchText}>
                      {isSignUp
                        ? "Already have an account? "
                        : "Don't have an account? "}
                      <Text style={styles.switchTextBold}>
                        {isSignUp ? "Sign In" : "Sign Up"}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    minHeight: height,
    paddingBottom: 100, // Extra space for keyboard
  },

  // Hero Section
  heroSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xl,
    position: "relative",
    paddingTop: height * 0.1,
  },

  // Floating Background Elements
  floatingElements: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  floatingCircle: {
    position: "absolute",
    borderRadius: theme.borderRadius.full,
  },
  circle1: {
    top: "20%",
    right: "10%",
    width: 80,
    height: 80,
    backgroundColor: theme.colors.primary,
    opacity: 0.1,
  },
  circle2: {
    top: "60%",
    left: "5%",
    width: 60,
    height: 60,
    backgroundColor: theme.colors.accent,
    opacity: 0.1,
  },
  circle3: {
    top: "30%",
    left: "15%",
    width: 40,
    height: 40,
    backgroundColor: theme.colors.secondary,
    opacity: 0.1,
  },

  // Logo
  logoContainer: {
    marginBottom: theme.spacing.xl,
    borderRadius: theme.borderRadius.full,
    overflow: "hidden",
    position: "relative",
  },
  logoGradient: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.lg,
  },
  logoGlow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
    opacity: 0.2,
    zIndex: -1,
  },
  logoEmoji: {
    fontSize: 56,
  },

  // Typography
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: theme.spacing.xl,
  },

  // Form Section
  formSection: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 50,
  },
  formContainer: {
    paddingHorizontal: theme.spacing.xl,
  },
  formCard: {
    borderRadius: theme.borderRadius.xl,
    overflow: "hidden",
    marginBottom: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  formCardGradient: {
    padding: theme.spacing.xl,
  },

  // Input Groups
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  inputWrapper: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  inputWrapperFocused: {
    borderColor: theme.colors.accent,
    ...theme.shadows.glow,
  },
  input: {
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: "transparent",
  },

  // Button
  button: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    ...theme.shadows.md,
  },
  buttonGradient: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.background,
    letterSpacing: 0.5,
  },

  // Switch Button
  switchButton: {
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  switchText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  switchTextBold: {
    color: theme.colors.accent,
    fontWeight: "700",
  },
});
