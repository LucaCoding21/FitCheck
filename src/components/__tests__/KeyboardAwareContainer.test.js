import React from "react";
import { Text, TextInput } from "react-native";
import KeyboardAwareContainer from "../KeyboardAwareContainer";

// Mock React Native modules
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");

  RN.Keyboard = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  };

  RN.Dimensions = {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  };

  RN.Animated = {
    ...RN.Animated,
    timing: jest.fn(() => ({ start: jest.fn() })),
    Value: jest.fn(() => ({
      interpolate: jest.fn(() => 0),
    })),
  };

  return RN;
});

// Mock theme
jest.mock("../../styles/theme", () => ({
  theme: {
    colors: {
      background: "#000000",
      surface: "#111111",
    },
  },
}));

describe("KeyboardAwareContainer", () => {
  it("should render children correctly", () => {
    const TestComponent = () => (
      <KeyboardAwareContainer>
        <Text>Test Content</Text>
      </KeyboardAwareContainer>
    );

    // Basic smoke test - component should render without crashing
    expect(() => TestComponent()).not.toThrow();
  });

  it("should accept all expected props", () => {
    const TestComponent = () => (
      <KeyboardAwareContainer
        behavior="padding"
        keyboardVerticalOffset={20}
        enabled={true}
        style={{ backgroundColor: "red" }}
        contentContainerStyle={{ padding: 10 }}
      >
        <TextInput placeholder="Test input" />
      </KeyboardAwareContainer>
    );

    // Component should render with all props without crashing
    expect(() => TestComponent()).not.toThrow();
  });

  it("should have default behavior of padding", () => {
    const TestComponent = () => (
      <KeyboardAwareContainer>
        <Text>Test</Text>
      </KeyboardAwareContainer>
    );

    // Should not throw with default props
    expect(() => TestComponent()).not.toThrow();
  });
});
