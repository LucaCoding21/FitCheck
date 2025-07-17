import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../styles/theme";

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

  const textInputRef = useRef(null);
  const suggestionHeight = useRef(new Animated.Value(0)).current;

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
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={textInputRef}
          style={styles.textInput}
          value={value}
          onChangeText={handleTextChange}
          onSelectionChange={(event) => {
            setCursorPosition(event.nativeEvent.selection.start);
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={maxLength}
          textAlignVertical="top"
        />

        {/* Character count */}
        <Text style={styles.characterCount}>
          {value.length}/{maxLength}
        </Text>
      </View>

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
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  inputContainer: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
    position: "relative",
  },
  textInput: {
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
    minHeight: 80,
    maxHeight: 120,
  },
  characterCount: {
    position: "absolute",
    bottom: theme.spacing.xs,
    right: theme.spacing.sm,
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontSize: 12,
  },

  // Parsed text styles (for preview)
  parsedText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  textPart: {
    color: theme.colors.text,
  },
  mention: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  hashtag: {
    color: theme.colors.secondary,
    fontWeight: "600",
  },

  // Suggestions styles
  suggestionsContainer: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.xs,
    overflow: "hidden",
    ...theme.shadows.md,
  },
  suggestionItem: {
    borderRadius: theme.borderRadius.md,
    marginHorizontal: theme.spacing.xs,
    marginVertical: 2,
    overflow: "hidden",
  },
  suggestionGradient: {
    padding: theme.spacing.sm,
  },
  suggestionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.sm,
  },
  avatarText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: "700",
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "600",
  },
  suggestionUsername: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  hashtagIcon: {
    ...theme.typography.body,
    color: theme.colors.secondary,
    fontWeight: "700",
    marginRight: theme.spacing.sm,
    fontSize: 18,
  },
  suggestionHashtag: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: "600",
  },
});

export default CaptionInput;
