import React, { useCallback } from "react";
import { View, Keyboard, SafeAreaView } from "react-native";
import { theme } from "../styles/theme";

const KeyboardAwareContainer = ({
  children,
  style,
  dismissKeyboardOnTap = true,
  ...props
}) => {
  // Remove TouchableWithoutFeedback wrapper that was blocking scroll events
  // The CaptionInput modal already handles its own keyboard dismissal properly
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={[{ flex: 1 }, style]} {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
};

export default KeyboardAwareContainer;
