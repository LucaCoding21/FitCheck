import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import KeyboardAwareContainer from '../components/KeyboardAwareContainer';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

// Custom Toast config
const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: '#2a2a2a',
        borderLeftColor: 'transparent',
        borderRadius: 12,
        minHeight: 48,
        alignItems: 'center',
        shadowOpacity: 0,
        marginHorizontal: 16,
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
        backgroundColor: '#2a2a2a',
        borderLeftColor: 'transparent',
        borderRadius: 12,
        minHeight: 48,
        alignItems: 'center',
        shadowOpacity: 0,
        marginHorizontal: 16,
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
        <Ionicons name="close-circle" size={22} color="#FF6B6B" style={{ marginRight: 8 }} />
      )}
    />
  ),
};

const SignInScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [showPassword, setShowPassword] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;

  // Refs for input focus management
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

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
      Animated.spring(titleScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const clearErrors = () => {
    setEmailError('');
    setPasswordError('');
  };

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleInputFocus = (inputName) => {
    setFocusedInput(inputName);
    clearErrors();
  };

  const handleInputBlur = () => {
    setFocusedInput(null);
  };

  const handleNextInput = (currentField) => {
    switch (currentField) {
      case 'email':
        passwordInputRef.current?.focus();
        break;
      case 'password':
        handleSignIn();
        break;
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const validateInputs = () => {
    let isValid = true;
    clearErrors();

    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    }

    return isValid;
  };

  const handleSignIn = async () => {
    if (!validateInputs()) {
      shakeAnimation();
      return;
    }

    setLoading(true);
    clearErrors();
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation will happen automatically when AuthContext updates
    } catch (error) {
      let errorMessage = 'Error signing in';
      let fieldError = '';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address';
        fieldError = 'No account found with this email';
        setEmailError(fieldError);
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
        fieldError = 'Incorrect password';
        setPasswordError(fieldError);
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address';
        fieldError = 'Please enter a valid email';
        setEmailError(fieldError);
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later';
        Toast.show({
          type: 'error',
          text1: errorMessage,
          position: 'bottom',
          visibilityTime: 4000,
          autoHide: true,
          bottomOffset: 60,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: errorMessage,
          position: 'bottom',
          visibilityTime: 3000,
          autoHide: true,
          bottomOffset: 60,
        });
      }
      
      shakeAnimation();
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setEmailError('Please enter your email address first');
      shakeAnimation();
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      shakeAnimation();
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Toast.show({
        type: 'success',
        text1: 'Password reset email sent',
        text2: 'Check your email for instructions',
        position: 'bottom',
        visibilityTime: 4000,
        autoHide: true,
        bottomOffset: 60,
      });
    } catch (error) {
      let errorMessage = 'Failed to send password reset email';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address';
        setEmailError('No account found with this email');
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address';
        setEmailError('Please enter a valid email');
      }
      
      Toast.show({
        type: 'error',
        text1: errorMessage,
        position: 'bottom',
        visibilityTime: 3000,
        autoHide: true,
        bottomOffset: 60,
      });
      shakeAnimation();
    }
  };

  const handleSignUp = () => {
    navigation.navigate('SignUp');
  };

  const handleClose = () => {
    navigation.navigate('Onboarding');
  };

  return (
    <>
      <KeyboardAwareContainer>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <View style={styles.container}>
          {/* Header Section */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Text style={styles.headerText}>Log in to your account</Text>
          </Animated.View>

          {/* Main Content Section */}
          <Animated.View
            style={[
              styles.contentSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Animated.Text
              style={[
                styles.title,
                {
                  transform: [{ scale: titleScale }],
                },
              ]}
            >
              Sign In
            </Animated.Text>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <View style={[
                styles.inputContainer,
                focusedInput === 'email' && styles.inputContainerFocused,
                emailError && styles.inputContainerError
              ]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={emailError ? '#FF6B6B' : focusedInput === 'email' ? '#B5483D' : '#71717A'}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={emailInputRef}
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#71717A"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onFocus={() => handleInputFocus('email')}
                  onBlur={handleInputBlur}
                  onSubmitEditing={() => handleNextInput('email')}
                />
              </View>
              {emailError && (
                <Animated.View 
                  style={[
                    styles.errorContainer,
                    { transform: [{ translateX: shakeAnim }] }
                  ]}
                >
                  <Ionicons name="alert-circle" size={14} color="#FF6B6B" />
                  <Text style={styles.errorText}>{emailError}</Text>
                </Animated.View>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <View style={[
                styles.inputContainer,
                focusedInput === 'password' && styles.inputContainerFocused,
                passwordError && styles.inputContainerError
              ]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={passwordError ? '#FF6B6B' : focusedInput === 'password' ? '#B5483D' : '#71717A'}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#71717A"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError('');
                  }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onFocus={() => handleInputFocus('password')}
                  onBlur={handleInputBlur}
                  onSubmitEditing={() => handleNextInput('password')}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={togglePasswordVisibility}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={passwordError ? '#FF6B6B' : focusedInput === 'password' ? '#B5483D' : '#71717A'}
                  />
                </TouchableOpacity>
              </View>
              {passwordError && (
                <Animated.View 
                  style={[
                    styles.errorContainer,
                    { transform: [{ translateX: shakeAnim }] }
                  ]}
                >
                  <Ionicons name="alert-circle" size={14} color="#FF6B6B" />
                  <Text style={styles.errorText}>{passwordError}</Text>
                </Animated.View>
              )}
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                (emailError || passwordError) && styles.continueButtonError
              ]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>
                {loading ? 'Signing In...' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer Section */}
          <Animated.View
            style={[
              styles.footerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text style={styles.signUpLink} onPress={handleSignUp}>
                Sign Up
              </Text>
            </Text>
            
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={handleForgotPassword}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAwareContainer>
      <Toast config={toastConfig} />
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 40,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  closeButton: {
    position: 'absolute',
    left: 0,
    zIndex: 1,
    padding: 8,
  },
  headerText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  contentSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
  },
  inputContainerFocused: {
    borderColor: '#B5483D',
    shadowColor: '#B5483D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  inputContainerError: {
    borderColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  eyeButton: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 4,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  continueButton: {
    backgroundColor: '#B5483D',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#B5483D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
  },
  continueButtonError: {
    backgroundColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footerSection: {
    alignItems: 'center',
    paddingBottom: 40,
    gap: 16,
  },
  footerText: {
    fontSize: 16,
    color: '#71717A',
    textAlign: 'center',
  },
  signUpLink: {
    color: '#B5483D',
    fontWeight: '600',
  },
  forgotPasswordButton: {
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 16,
    color: '#B5483D',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SignInScreen; 