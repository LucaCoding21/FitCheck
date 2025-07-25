import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const FitCardSkeleton = () => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.profileImage, { opacity: pulseAnim }]} />
        <View style={styles.headerText}>
          <Animated.View style={[styles.username, { opacity: pulseAnim }]} />
          <Animated.View style={[styles.timestamp, { opacity: pulseAnim }]} />
        </View>
        <Animated.View style={[styles.moreButton, { opacity: pulseAnim }]} />
      </View>

      {/* Image */}
      <Animated.View style={[styles.image, { opacity: pulseAnim }]} />

      {/* Actions */}
      <View style={styles.actions}>
        <Animated.View style={[styles.actionButton, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.actionButton, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.actionButton, { opacity: pulseAnim }]} />
      </View>

      {/* Caption */}
      <View style={styles.caption}>
        <Animated.View style={[styles.captionLine, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.captionLineShort, { opacity: pulseAnim }]} />
      </View>

      {/* Tag */}
      <Animated.View style={[styles.tag, { opacity: pulseAnim }]} />

      {/* Rating */}
      <View style={styles.rating}>
        <Animated.View style={[styles.ratingText, { opacity: pulseAnim }]} />
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Animated.View key={star} style={[styles.star, { opacity: pulseAnim }]} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a3a3a',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  username: {
    height: 16,
    width: 120,
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
    marginBottom: 4,
  },
  timestamp: {
    height: 12,
    width: 80,
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
  },
  moreButton: {
    width: 24,
    height: 24,
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
  },
  image: {
    width: '100%',
    height: width - 32, // Square aspect ratio
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    backgroundColor: '#3a3a3a',
    borderRadius: 16,
    marginRight: 16,
  },
  caption: {
    marginBottom: 8,
  },
  captionLine: {
    height: 14,
    width: '100%',
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
    marginBottom: 6,
  },
  captionLineShort: {
    height: 14,
    width: '60%',
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
  },
  tag: {
    height: 24,
    width: 80,
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    marginBottom: 12,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingText: {
    height: 16,
    width: 60,
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
  },
  stars: {
    flexDirection: 'row',
  },
  star: {
    width: 16,
    height: 16,
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    marginLeft: 4,
  },
});

export default FitCardSkeleton; 