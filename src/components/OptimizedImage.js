import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

export default function OptimizedImage({ 
  source, 
  style, 
  placeholder = null,
  contentFit = 'cover',
  transition = 300,
  cachePolicy = 'memory-disk',
  priority = 'normal',
  onLoad,
  onError,
  showLoadingIndicator = true,
  showErrorState = true,
  ...props 
}) {
  // Safety check for source
  if (!source) {
    return (
      <View style={[style, styles.errorContainer]}>
        <Ionicons name="image-outline" size={32} color="#666" />
        <Text style={styles.errorText}>No image</Text>
      </View>
    );
  }
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  if (hasError && showErrorState) {
    return (
      <View style={[style, styles.errorContainer]}>
        <Ionicons name="image-outline" size={32} color="#666" />
        <Text style={styles.errorText}>Failed to load</Text>
      </View>
    );
  }

  return (
    <View style={style}>
      <Image
        source={source}
        style={styles.image}
        contentFit={contentFit}
        transition={transition}
        cachePolicy={cachePolicy}
        priority={priority}
        placeholder={placeholder}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
      
      {isLoading && showLoadingIndicator && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6366F1" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  errorText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
}); 