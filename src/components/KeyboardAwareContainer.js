import React from "react";
import { View, Keyboard, SafeAreaView, TouchableWithoutFeedback } from "react-native";
import { theme } from "../styles/theme";

const KeyboardAwareContainer = ({
  children,
  style,
  dismissKeyboardOnTap = true,
  ...props
}) => {
  const handleScreenTap = () => {
    if (dismissKeyboardOnTap) {
      Keyboard.dismiss();
    }
  };

  const ContainerComponent = dismissKeyboardOnTap ? TouchableWithoutFeedback : View;
  const containerProps = dismissKeyboardOnTap ? { onPress: handleScreenTap } : {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ContainerComponent {...containerProps}>
        <View style={[{ flex: 1 }, style]} {...props}>
          {children}
        </View>
      </ContainerComponent>
    </SafeAreaView>
  );
};

export default KeyboardAwareContainer;
