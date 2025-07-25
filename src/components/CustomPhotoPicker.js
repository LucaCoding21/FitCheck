import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions,
  StatusBar,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import OptimizedImage from './OptimizedImage';

const { width, height } = Dimensions.get('window');

const CustomPhotoPicker = ({ visible, onClose, onImageSelected }) => {
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [endCursor, setEndCursor] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      requestPermissions();
      animateIn();
    } else {
      // Cleanup when modal closes
      setPhotos([]);
      setAlbums([]);
      setSelectedPhoto(null);
      setSelectedAlbum(null);
      setShowAlbumPicker(false);
    }
  }, [visible]);

  useEffect(() => {
    if (selectedAlbum) {
      // Reset pagination state when switching albums
      setHasNextPage(true);
      setEndCursor(null);
      setSelectedPhoto(null);
      fetchPhotosFromAlbum();
    }
  }, [selectedAlbum]);

  const animateIn = () => {
    // Simple fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const requestPermissions = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        fetchAlbums();
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      const albums = await MediaLibrary.getAlbumsAsync();
      

      
      // Find the "All Photos" album (this is the main album with all photos)
      const allPhotosAlbum = albums.find(album => 
        album.title.toLowerCase().includes('all photos') ||
        album.title.toLowerCase().includes('all') ||
        album.title.toLowerCase().includes('camera roll') ||
        album.title.toLowerCase().includes('recent')
      );
      
      // Create a "Recent" album that actually shows all photos
      const recentAlbum = {
        id: allPhotosAlbum?.id || 'all',
        title: 'Recent',
        assetCount: allPhotosAlbum?.assetCount || 0,
        isAllPhotos: true,
      };
      
      const albumList = [recentAlbum];
      albumList.push(...albums.filter(album => album !== allPhotosAlbum));
      
      // Get thumbnails for each album
      const albumsWithThumbnails = await Promise.all(
        albumList.map(async (album) => {
          try {
            let options;
            if (album.isAllPhotos) {
              options = {
                first: 1,
                sortBy: ['creationTime'],
                mediaType: ['photo'],
              };
            } else {
              options = {
                first: 1,
                album: album.id,
                sortBy: ['creationTime'],
                mediaType: ['photo'],
              };
            }
            
            const result = await MediaLibrary.getAssetsAsync(options);
            return {
              ...album,
              thumbnail: result.assets.length > 0 ? result.assets[0].uri : null,
            };
          } catch (error) {
            console.error('Error fetching thumbnail for album:', album.title, error);
            return {
              ...album,
              thumbnail: null,
            };
          }
        })
      );
      
      setAlbums(albumsWithThumbnails);
      setSelectedAlbum(albumsWithThumbnails[0]);
    } catch (error) {
      console.error('Error fetching albums:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhotosFromAlbum = async (isLoadMore = false) => {
    try {
      setLoading(true);
      
      let options;
      if (selectedAlbum?.isAllPhotos) {
        // For "Recent" album (which is actually "All Photos"), fetch all photos sorted by creation time
        options = {
          first: 50, // Increased for better pagination
          sortBy: ['creationTime'],
          mediaType: ['photo'],
          quality: 1.0, // Full quality for better preview
        };
      } else {
        // For other albums, use the album ID
        options = {
          first: 50, // Increased for better pagination
          album: selectedAlbum?.id,
          sortBy: ['creationTime'],
          mediaType: ['photo'],
          quality: 1.0, // Full quality for better preview
        };
      }
      
      // Add pagination cursor if loading more
      if (isLoadMore && endCursor) {
        options.after = endCursor;
      }
      
      const result = await MediaLibrary.getAssetsAsync(options);

      
      if (isLoadMore) {
        // Append new photos to existing ones
        setPhotos(prevPhotos => [...prevPhotos, ...result.assets]);
      } else {
        // Replace photos for new album selection
        setPhotos(result.assets);
      }
      
      // Update pagination state
      setHasNextPage(result.hasNextPage);
      setEndCursor(result.endCursor);
      
      // Set first photo as selected by default (only for new album selection)
      if (!isLoadMore && result.assets.length > 0 && !selectedPhoto) {
        setSelectedPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0]); // Pass full asset object
        onClose();
      }
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  const handlePhotoSelect = (photo) => {
    setSelectedPhoto(photo);
  };

  const handleNext = () => {
    if (selectedPhoto) {
      // Direct transition without animation for better performance
      onImageSelected(selectedPhoto);
    }
  };

  const handleLoadMore = () => {
    if (hasNextPage && !loading) {
      fetchPhotosFromAlbum(true);
    }
  };

  const renderPhotoItem = ({ item, index }) => {
    const isFirst = index === 0;
    
    if (isFirst) {
      // Camera button
      return (
        <TouchableOpacity
          style={styles.photoItem}
          onPress={handleTakePhoto}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.cameraButton}>
            <Ionicons name="camera" size={24} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      );
    }

    const photo = item;
    const isSelected = selectedPhoto?.id === photo.id;

    return (
      <TouchableOpacity
        style={styles.photoItem}
        onPress={() => handlePhotoSelect(photo)}
        activeOpacity={0.8}
      >
        <OptimizedImage
          source={{ uri: photo.uri }}
          style={styles.photoThumbnail}
          contentFit="cover"
          priority="normal"
          cachePolicy="memory-disk"
        />
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <View style={styles.whiteOverlay} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderAlbumItem = ({ item }) => (
    <TouchableOpacity
      style={styles.albumItem}
      onPress={() => {
        setSelectedAlbum(item);
        setShowAlbumPicker(false);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.albumThumbnail}>
        {item.thumbnail ? (
          <OptimizedImage
            source={{ uri: item.thumbnail }}
            style={styles.albumThumbnailImage}
            contentFit="cover"
            priority="normal"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.albumThumbnailPlaceholder}>
            <Ionicons name="images-outline" size={24} color="#71717A" />
          </View>
        )}
      </View>
      <View style={styles.albumInfo}>
        <Text style={styles.albumText}>{item.title}</Text>
        <Text style={styles.albumCount}>{item.assetCount}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.headerButton, styles.nextButton]}
            onPress={handleNext}
            disabled={!selectedPhoto}
            activeOpacity={0.7}
          >
            <Text style={[styles.headerButtonText, !selectedPhoto && styles.disabledText]}>
              Next
            </Text>
            <Ionicons 
              name="chevron-forward" 
              size={16} 
              color={selectedPhoto ? "#FFFFFF" : "#71717A"} 
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>

        {/* Main Image Preview */}
        <View style={styles.previewContainer}>
          {selectedPhoto ? (
            <OptimizedImage
              source={{ uri: selectedPhoto.uri }}
              style={styles.previewImage}
              contentFit="cover"
              priority="high"
              cachePolicy="memory-disk"
              transition={200}
              showLoadingIndicator={true}
            />
          ) : (
            <View style={styles.emptyPreview}>
              <Ionicons name="image-outline" size={48} color="#71717A" />
              <Text style={styles.emptyPreviewText}>Select a photo</Text>
            </View>
          )}
        </View>

        {/* Album Selector */}
        <TouchableOpacity
          style={styles.albumSelector}
          onPress={() => setShowAlbumPicker(!showAlbumPicker)}
          activeOpacity={0.8}
        >
          <Text style={styles.albumSelectorText}>
            {selectedAlbum?.title || 'Recent'}
          </Text>
          <Ionicons 
            name={showAlbumPicker ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#71717A" 
          />
        </TouchableOpacity>

        {/* Album Picker Modal */}
        {showAlbumPicker && (
          <View style={styles.albumPickerOverlay}>
            <View style={styles.albumPickerContainer}>
              <View style={styles.albumPickerHeader}>
                <Text style={styles.albumPickerTitle}>Albums</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowAlbumPicker(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={albums}
                renderItem={renderAlbumItem}
                keyExtractor={(item) => item.id}
                style={styles.albumPicker}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                initialNumToRender={10}
                contentContainerStyle={styles.albumPickerContent}
              />
            </View>
          </View>
        )}

        {/* Photo Grid */}
        <View style={styles.photoGridContainer}>
          {photos.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={48} color="#71717A" />
              <Text style={styles.emptyStateText}>No photos found</Text>
              <Text style={styles.emptyStateSubtext}>Try selecting a different album</Text>
            </View>
          ) : (
            <FlatList
              data={[{ id: 'camera' }, ...photos]}
              renderItem={renderPhotoItem}
              keyExtractor={(item, index) => item.id || `camera-${index}`}
              numColumns={3}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.photoGrid}
              columnWrapperStyle={styles.photoRow}
              removeClippedSubviews={true}
              maxToRenderPerBatch={9}
              windowSize={5}
              initialNumToRender={9}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  <Ionicons name="images-outline" size={48} color="#71717A" />
                  <Text style={styles.emptyStateText}>No photos found</Text>
                </View>
              )}
              ListFooterComponent={() => 
                hasNextPage && loading ? (
                  <View style={styles.loadingFooter}>
                    <ActivityIndicator size="small" color="#B5483D" />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledText: {
    color: '#71717A',
  },
  previewContainer: {
    aspectRatio: 3/3,
    marginHorizontal: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  emptyPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPreviewText: {
    color: '#71717A',
    fontSize: 16,
    marginTop: 12,
  },
  albumSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginHorizontal: 20,
    marginTop: 0,
    marginBottom: 10,
  },
  albumSelectorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  albumPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  albumPickerContainer: {
    position: 'absolute',
    top: 200,
    left: 0,
    right: 0,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    height: height * 0.8,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  albumPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  albumPickerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  albumPicker: {
    flex: 1,
  },
  albumPickerContent: {
    padding: 8,
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  albumText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },
  albumCount: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '400',
  },
  albumThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#3a3a3a',
  },
  albumThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  albumThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3a3a3a',
  },
  albumInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoGridContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  photoGrid: {
    paddingTop: 5,
  },
  photoRow: {
    justifyContent: 'space-between',
    marginBottom: 0.5,
    paddingHorizontal: 0,
  },
  photoItem: {
    width: (width - 8) / 3,
    height: (width - 8) / 3,
    marginBottom: 0.5,
    marginRight: 2,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraButton: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whiteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#71717A',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
  },
  emptyStateSubtext: {
    color: '#71717A',
    fontSize: 14,
    marginTop: 8,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default CustomPhotoPicker; 