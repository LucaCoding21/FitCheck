import React, { useEffect, useRef, useState } from "react";
import { View, Keyboard, Animated, Platform, SafeAreaView } from "react-native";
import { theme } from "../styles/theme";

const KeyboardAwareContainer = ({
  children,
  behavior = "padding",
  keyboardVerticalOffset = 0,
  style,
  enabled = true,
  ...props
}) => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyboardShow = (event) => {
      const { height, duration } = event.endCoordinates;
      const adjustedHeight = Math.max(0, height - keyboardVerticalOffset);

      setKeyboardHeight(adjustedHeight);

      Animated.timing(animatedValue, {
        toValue: adjustedHeight,
        duration: Platform.OS === "ios" ? duration || 250 : 250,
        useNativeDriver: false,
      }).start();
    };

    const handleKeyboardHide = (event) => {
      const duration = Platform.OS === "ios" ? event?.duration || 250 : 250;

      Animated.timing(animatedValue, {
        toValue: 0,
        duration,
        useNativeDriver: false,
      }).start(() => {
        setKeyboardHeight(0);
      });
    };

    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      handleKeyboardShow
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      handleKeyboardHide
    );

    return () => {
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, [enabled, keyboardVerticalOffset, animatedValue]);

  const containerStyle = [
    {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingBottom: behavior === "padding" ? animatedValue : 0,
    },
    style,
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Animated.View style={containerStyle} {...props}>
        {children}
      </Animated.View>
    </SafeAreaView>
  );
};

export default KeyboardAwareContainer;
