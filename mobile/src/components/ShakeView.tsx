import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Animated, ViewStyle, StyleProp } from "react-native";

export interface ShakeViewHandle {
  shake: () => void;
}

interface ShakeViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Imperative horizontal shake — call `ref.current?.shake()` on a validation
// or login failure to give a physical "no" without another alert popup.
export const ShakeView = forwardRef<ShakeViewHandle, ShakeViewProps>(({ children, style }, ref) => {
  const translateX = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    shake: () => {
      translateX.setValue(0);
      Animated.sequence([
        Animated.timing(translateX, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 6, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    },
  }));

  return <Animated.View style={[style, { transform: [{ translateX }] }]}>{children}</Animated.View>;
});

ShakeView.displayName = "ShakeView";
