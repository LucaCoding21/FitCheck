import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  PanGestureHandler,
  State,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Comment from './Comment';
import CommentInput from './CommentInput';

const { height: screenHeight } = Dimensions.get('window');

export default function CommentModal({ 
  isVisible, 
  onClose, 
  fit, 
  comments = [],
  onCommentAdded
}) {
  const { user } = useAuth();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const inputSlideAnim = useRef(new Animated.Value(0)).current;

  const handleClose = () => {
    // Immediately set closing state to disable pointer events
    setIsClosing(true);
    // Call the original onClose
    onClose();
  };

  useEffect(() => {
    if (isVisible) {
      // Show modal immediately
      setModalVisible(true);
      setIsClosing(false);
      
      // Reset animation values before opening
      resetAnimationValues();
      
      // Animate in with spring effect for natural feel
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Mark as closing to disable backdrop interactions
      setIsClosing(true);
      
      // Reset keyboard state when modal closes
      setKeyboardVisible(false);
      
      // Animate out - faster spring animation but still visible
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: screenHeight,
          tension: 45, // Higher tension = faster animation
          friction: 12, // Lower friction = less damping
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 400, // Shorter duration for faster feel
          useNativeDriver: true,
        }),
        Animated.timing(inputSlideAnim, {
          toValue: 0, // Reset input position
          duration: 400, // Match the backdrop duration
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hide modal after animation completes
        setModalVisible(false);
        // Add a small delay to ensure backdrop is completely cleared
        setTimeout(() => {
          setIsClosing(false);
          resetAnimationValues();
        }, 50);
      });
    }
  }, [isVisible]);

  useEffect(() => {
    // Keyboard listeners - use 'Will' events to match keyboard timing
    const keyboardWillShowListener = Keyboard.addListener(
      'keyboardWillShow',
      (event) => {
        setKeyboardVisible(true);
        // Move input area up slightly faster than keyboard
        Animated.timing(inputSlideAnim, {
          toValue: -event.endCoordinates.height,
          duration: (event.duration || 250) * 0.8, // 20% faster than keyboard
          useNativeDriver: true,
        }).start();
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      'keyboardWillHide',
      (event) => {
        setKeyboardVisible(false);
        // Move input area back down slightly faster than keyboard
        Animated.timing(inputSlideAnim, {
          toValue: 0,
          duration: (event.duration || 250) * 0.8, // 20% faster than keyboard
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, []);

  const resetAnimationValues = () => {
    slideAnim.setValue(screenHeight);
    backdropOpacity.setValue(0);
    inputSlideAnim.setValue(0);
  };

  const handleCommentAdded = (newComment) => {
    // Notify parent component about the new comment
    if (onCommentAdded) {
      onCommentAdded(newComment);
    }
  };

  const renderComment = ({ item, index }) => (
    <Comment comment={item} />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.title}>Comments</Text>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInput = () => (
    <Animated.View 
      style={[
        styles.inputContainer,
        {
          transform: [{ translateY: inputSlideAnim }]
        }
      ]}
      pointerEvents="auto"
    >
      <CommentInput 
        fitId={fit?.id} 
        onCommentAdded={handleCommentAdded}
        placeholder={`Add a comment for ${fit?.userName || 'user'}...`}
      />
    </Animated.View>
  );

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
      hardwareAccelerated={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.container} pointerEvents="auto">
        {/* Backdrop */}
        <Animated.View 
          style={[
            styles.backdrop,
            { opacity: backdropOpacity }
          ]}
          pointerEvents={isVisible && !keyboardVisible && !isClosing ? "auto" : "none"}
        >
          <TouchableOpacity 
            style={styles.backdropTouchable}
            onPress={handleClose}
            activeOpacity={1}
          />
        </Animated.View>

        {/* Modal Content - Completely disabled during closing */}
        {!isClosing && (
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  { translateY: slideAnim }
                ]
              }
            ]}
            pointerEvents="auto"
          >
          {renderHeader()}
          
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item, index) => `${fit?.id}_comment_${item.id || index}`}
            style={styles.commentsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.commentsContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment!</Text>
              </View>
            }
          />
          
          {renderInput()}
        </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  backdropTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.9, // Increased from 0.8 to 0.9 (100px bigger)
    minHeight: screenHeight * 0.7, // Increased from 0.4 to 0.5
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1A1A1A',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#666666',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  dragHint: {
    fontSize: 12,
    color: '#71717A',
    position: 'absolute',
    bottom: 8,
    right: 20,
    opacity: 0.7,
  },
  shareButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 18,
  },
  commentsList: {
    flex: 1,
  },
  commentsContent: {
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'center',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1A1A1A',
    zIndex: 1000,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
}); 