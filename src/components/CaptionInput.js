import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  Dimensions,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../styles/theme";
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const CaptionInput = ({
  value,
  onChangeText,
  placeholder = "What's the vibe?",
  maxLength = 200,
  style,
  onMentionPress,
  onHashtagPress,
  users = [],
  hashtags = [],
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionType, setSuggestionType] = useState(null); // 'mention' or 'hashtag'
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentQuery, setCurrentQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const textInputRef = useRef(null);
  const suggestionHeight = useRef(new Animated.Value(0)).current;
  
  // Enhanced animation values for Instagram-like transitions
  const modalAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;

  // Parse text for mentions and hashtags
  const parseText = (text) => {
    const parts = [];
    const regex = /(@\w+|#\w+)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, match.index),
          type: "text",
        });
      }

      // Add the match (mention or hashtag)
      parts.push({
        text: match[0],
        type: match[0].startsWith("@") ? "mention" : "hashtag",
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
        type: "text",
      });
    }

    return parts;
  };

  // Handle text changes and detect triggers
  const handleTextChange = (text) => {
    onChangeText(text);

    // Find current word at cursor position
    const beforeCursor = text.substring(0, cursorPosition);
    const words = beforeCursor.split(/\s/);
    const currentWord = words[words.length - 1];

    if (currentWord.startsWith("@") && currentWord.length > 1) {
      // Show user suggestions
      const query = currentWord.substring(1).toLowerCase();
      const filteredUsers = users.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.username?.toLowerCase().includes(query)
      );

      setSuggestions(filteredUsers.slice(0, 5));
      setSuggestionType("mention");
      setCurrentQuery(query);
      showSuggestionsList();
    } else if (currentWord.startsWith("#") && currentWord.length > 1) {
      // Show hashtag suggestions
      const query = currentWord.substring(1).toLowerCase();
      const filteredHashtags = hashtags.filter((tag) =>
        tag.toLowerCase().includes(query)
      );

      setSuggestions(filteredHashtags.slice(0, 5));
      setSuggestionType("hashtag");
      setCurrentQuery(query);
      showSuggestionsList();
    } else {
      hideSuggestionsList();
    }
  };

  const showSuggestionsList = () => {
    setShowSuggestions(true);
    Animated.timing(suggestionHeight, {
      toValue: 150,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const hideSuggestionsList = () => {
    Animated.timing(suggestionHeight, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      setShowSuggestions(false);
      setSuggestions([]);
      setSuggestionType(null);
    });
  };

  // Enhanced focus animation - Instagram-like smooth entrance
  const handleFocus = () => {
    setIsFocused(true);
    
    // Reset animation values
    scaleAnim.setValue(0.95);
    opacityAnim.setValue(0);
    translateYAnim.setValue(50);
    
    // Parallel animations for smooth entrance
    Animated.parallel([
      Animated.timing(modalAnim, {
        toValue: 1,
        duration: 250, // Faster animation
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 250, // Faster animation
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200, // Faster animation
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 250, // Faster animation
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Enhanced blur animation - Instagram-like smooth exit
  const handleBlur = () => {
    // Set focused state immediately for responsive UI
    setIsFocused(false);
    
    // Hide suggestions immediately to prevent interference
    hideSuggestionsList();
    
    // Run animations in background without blocking UI
    Animated.parallel([
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 150, // Even faster for better responsiveness
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 150, // Even faster for better responsiveness
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 100, // Even faster for better responsiveness
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 50,
        duration: 150, // Even faster for better responsiveness
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Handle suggestion selection
  const handleSuggestionPress = (suggestion) => {
    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);

    // Find the start of the current word
    const words = beforeCursor.split(/\s/);
    const currentWord = words[words.length - 1];
    const wordStart = beforeCursor.lastIndexOf(currentWord);

    let replacement;
    if (suggestionType === "mention") {
      replacement = `@${suggestion.username || suggestion.name}`;
      onMentionPress?.(suggestion);
    } else {
      replacement = `#${suggestion}`;
      onHashtagPress?.(suggestion);
    }

    const newText =
      beforeCursor.substring(0, wordStart) + replacement + " " + afterCursor;

    onChangeText(newText);
    hideSuggestionsList();

    // Focus back to input
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  };

  // Render parsed text with styling
  const renderParsedText = () => {
    const parts = parseText(value);
    return (
      <Text style={styles.parsedText}>
        {parts.map((part, index) => (
          <Text
            key={index}
            style={[
              styles.textPart,
              part.type === "mention" && styles.mention,
              part.type === "hashtag" && styles.hashtag,
            ]}
          >
            {part.text}
          </Text>
        ))}
      </Text>
    );
  };

  const renderSuggestionItem = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSuggestionPress(item)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={[theme.colors.surface, theme.colors.card]}
        style={styles.suggestionGradient}
      >
        {suggestionType === "mention" ? (
          <View style={styles.suggestionContent}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.name || item.username || "U")[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.suggestionText}>
              <Text style={styles.suggestionName}>{item.name}</Text>
              {item.username && (
                <Text style={styles.suggestionUsername}>@{item.username}</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.suggestionContent}>
            <Text style={styles.hashtagIcon}>#</Text>
            <Text style={styles.suggestionHashtag}>{item}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Regular input (shown when not focused) */}
      <View style={[styles.container, style, isFocused && styles.hidden]}>
        <TextInput
          ref={textInputRef}
          style={styles.textInput}
          value={value}
          onChangeText={handleTextChange}
          onSelectionChange={(event) => {
            setCursorPosition(event.nativeEvent.selection.start);
          }}
          onFocus={handleFocus}
          placeholder={placeholder}
          placeholderTextColor="#666666"
          multiline
          maxLength={maxLength}
          textAlignVertical="top"
        />

        {/* Character count */}
        <Text style={styles.characterCount}>
          {value.length}/{maxLength}
        </Text>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <Animated.View
            style={[styles.suggestionsContainer, { height: suggestionHeight }]}
          >
            <FlatList
              data={suggestions}
              keyExtractor={(item, index) =>
                suggestionType === "mention"
                  ? item.id || item.username || index.toString()
                  : item + index.toString()
              }
              renderItem={renderSuggestionItem}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </Animated.View>
        )}
      </View>

      {/* Full-screen modal for focused input */}
      <Modal
        visible={isFocused}
        transparent={true}
        animationType="none"
        onRequestClose={handleBlur}
        hardwareAccelerated={true}
        statusBarTranslucent={true}
      >
        <Animated.View 
          style={[
            styles.modalOverlay,
            {
              opacity: modalAnim,
            },
          ]}
        >
          {/* Greyed background with fade animation */}
          <Animated.View 
            style={[
              styles.modalBackground,
              {
                opacity: modalAnim,
              },
            ]}
          >
            <TouchableOpacity 
              style={styles.modalBackgroundTouchable} 
              activeOpacity={1}
              onPress={handleBlur}
            />
          </Animated.View>
          
          {/* Top input container with enhanced animations */}
          <Animated.View 
            style={[
              styles.modalInputContainer,
              {
                transform: [
                  {
                    translateY: translateYAnim,
                  },
                  {
                    scale: scaleAnim,
                  },
                ],
                opacity: opacityAnim,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalSpacer} />
              <Text style={styles.modalTitle}>Caption</Text>
              <TouchableOpacity 
                style={styles.modalDoneButton}
                onPress={handleBlur}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: modalAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                </Animated.View>
              </TouchableOpacity>
            </View>

            {/* Input */}
            <View style={styles.modalInputWrapper}>
              <TextInput
                style={styles.modalTextInput}
                value={value}
                onChangeText={handleTextChange}
                onSelectionChange={(event) => {
                  setCursorPosition(event.nativeEvent.selection.start);
                }}
                placeholder={placeholder}
                placeholderTextColor="#666666"
                multiline
                maxLength={maxLength}
                textAlignVertical="top"
                autoFocus={true}
              />
              
              {/* Character count */}
              <Text style={styles.modalCharacterCount}>
                {value.length}/{maxLength}
              </Text>
            </View>

            {/* Suggestions in modal */}
            {showSuggestions && (
              <Animated.View
                style={[styles.modalSuggestionsContainer, { height: suggestionHeight }]}
              >
                <FlatList
                  data={suggestions}
                  keyExtractor={(item, index) =>
                    suggestionType === "mention"
                      ? item.id || item.username || index.toString()
                      : item + index.toString()
                  }
                  renderItem={renderSuggestionItem}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                />
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  hidden: {
    opacity: 0,
  },
  textInput: {
    fontSize: 16,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  characterCount: {
    position: "absolute",
    bottom: 8,
    right: 16,
    color: '#666666',
    fontSize: 12,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalBackgroundTouchable: {
    flex: 1,
  },
  modalInputContainer: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingTop: 60, // Safe area
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalDoneButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#B5483D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalSpacer: {
    width: 40,
  },
  modalInputWrapper: {
    position: 'relative',
    paddingHorizontal: 16,
  },
  modalTextInput: {
    fontSize: 16,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 32,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#333333',
    borderRadius: 12,
  },
  modalCharacterCount: {
    position: "absolute",
    bottom: 8,
    right: 16,
    color: '#666666',
    fontSize: 12,
  },
  modalSuggestionsContainer: {
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    marginTop: 8,
    marginHorizontal: 16,
    overflow: "hidden",
  },

  // Parsed text styles (for preview)
  parsedText: {
    color: '#FFFFFF',
  },
  textPart: {
    color: '#FFFFFF',
  },
  mention: {
    color: '#D9534F',
    fontWeight: "600",
  },
  hashtag: {
    color: '#D9534F',
    fontWeight: "600",
  },

  // Suggestions styles
  suggestionsContainer: {
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    marginTop: 4,
    overflow: "hidden",
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  suggestionItem: {
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
    overflow: "hidden",
  },
  suggestionGradient: {
    padding: 12,
  },
  suggestionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D9534F',
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: "700",
    fontSize: 14,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    color: '#FFFFFF',
    fontWeight: "600",
    fontSize: 14,
  },
  suggestionUsername: {
    color: '#666666',
    fontSize: 12,
  },
  hashtagIcon: {
    color: '#D9534F',
    fontWeight: "700",
    marginRight: 12,
    fontSize: 18,
  },
  suggestionHashtag: {
    color: '#FFFFFF',
    fontWeight: "600",
    fontSize: 14,
  },
});

export default CaptionInput;
