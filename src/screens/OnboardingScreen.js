import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../styles/theme';

const { width, height } = Dimensions.get('window');

const fitImages = [
  require('../../assets/image_1.png'),
  require('../../assets/image_2.png'),
  require('../../assets/image_3.png'),
  require('../../assets/image_4.png'),
  require('../../assets/image_5.png'),
  require('../../assets/image_6.png'),
];

const OnboardingScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const starScale = useRef(new Animated.Value(0.8)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const imageAnimations = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    // Main entrance animation
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
      Animated.spring(starScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered image animations
    imageAnimations.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    });

    // Continuous rotation animation
    const startRotation = () => {
      Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 10000, // 10 seconds for full rotation
          useNativeDriver: true,
        })
      ).start();
    };

    // Start rotation after initial animations
    setTimeout(startRotation, 2000);
  }, []);

  const handleGetStarted = () => {
    // Navigate to registration/signup flow
    navigation.navigate('Auth', { mode: 'signup' });
  };

  const handleSignIn = () => {
    // Navigate to sign in flow
    navigation.navigate('Auth', { mode: 'signin' });
  };

  // Calculate positions for images in elliptical pattern
  const getImagePosition = (index) => {
    const radiusX = width * 0.35;
    const radiusY = height * 0.15;
    const angle = (index * 60) * (Math.PI / 180);
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    const rotation = 0; // More pronounced rotation for crooked effect
    return { x, y, rotation };
  };

  // Custom star component instead of blurry image
  const StarIcon = () => (
    <View style={styles.customStar}>
      <Text style={styles.starText}>★</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <Animated.View
        style={[
          styles.heroSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Central Star */}
        <Animated.View
          style={[
            styles.starContainer,
            {
              transform: [{ scale: starScale }],
            },
          ]}
        >
          {/* Outer ring */}
          <View style={styles.outerRing} />
          {/* First inner circle */}
          <View style={styles.innerCircle1} />
          {/* Second inner circle */}
          <View style={styles.innerCircle2} />
          <StarIcon />
        </Animated.View>

        {/* Circular Image Array */}
        <Animated.View
          style={[
            styles.imageArray,
            {
              transform: [
                {
                  rotate: rotationAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const position = getImagePosition(index);
            return (
              <Animated.View
                key={index}
                style={[
                  styles.imageWrapper,
                  {
                    transform: [
                      { translateX: position.x },
                      { translateY: position.y },
                      { scale: imageAnimations[index] },
                      { rotate: rotationAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '-360deg'],
                        }) },
                    ],
                  },
                ]}
              >
                <Image
                  source={fitImages[index]}
                  style={styles.fitImage}
                  resizeMode="cover"
                />
              </Animated.View>
            );
          })}
        </Animated.View>
      </Animated.View>

      {/* Text Section */}
      <Animated.View
        style={[
          styles.textSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.headline}>Welcome to FitCheck</Text>
        <Text style={styles.tagline}>Style it. Share it. Score it.</Text>
      </Animated.View>

      {/* CTA Buttons */}
      <Animated.View
        style={[
          styles.buttonSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <View style={styles.primaryButtonContent}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleSignIn}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  starContainer: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    strokeWidth: 0,
    borderRadius: 150,
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 100,
    shadowRadius: 80,
    elevation: 16,
    zIndex: -1,
  },
  innerCircle1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'transparent',
    shadowColor: '#CD9F3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 25,
    elevation: 8,
    zIndex: -1,
  },
  innerCircle2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 100,
    backgroundColor: '#1a1a1a',
    shadowColor: '#CD9F3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    zIndex: -1,
  },
  customStar: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starText: {
    fontSize: 100,
    color: '#CD9F3E',
  },
  imageArray: {
    position: 'absolute',
    width: 100,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    position: 'absolute',
    width: 120,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  fitImage: {
    width: 100,
    height: '100%',
    zIndex: 100,
  },
  textSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 60,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  buttonSection: {
    paddingHorizontal: 40,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#B5483D',
    borderRadius: 100,
    overflow: 'hidden',
    shadowColor: '#B5483D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonContent: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
});

export default OnboardingScreen; 