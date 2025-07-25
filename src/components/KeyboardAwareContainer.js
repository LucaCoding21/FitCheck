import React, { useCallback } from "react";
import { View, Keyboard, SafeAreaView, TouchableWithoutFeedback } from "react-native";
import { theme } from "../styles/theme";

const KeyboardAwareContainer = ({
  children,
  style,
  dismissKeyboardOnTap = true,
  ...props
}) => {
  const handleScreenTap = useCallback(() => {
    if (dismissKeyboardOnTap) {
      Keyboard.dismiss();
    }
  }, [dismissKeyboardOnTap]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {dismissKeyboardOnTap ? (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={[{ flex: 1 }, style]} {...props}>
            {children}
          </View>
        </TouchableWithoutFeedback>
      ) : (
        <View style={[{ flex: 1 }, style]} {...props}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
};

export default KeyboardAwareContainer;
