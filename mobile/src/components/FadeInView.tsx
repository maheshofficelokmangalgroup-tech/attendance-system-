import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle, StyleProp } from "react-native";

interface FadeInViewProps {
  children: React.ReactNode;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  translateY?: number;
}

// Fades (and optionally slides up slightly) its children in on mount.
// Extracted from the ad hoc fade-in pattern a few screens already used
// (Animated.Value + Animated.timing, 250ms, useNativeDriver) so every screen
// gets the same entrance instead of duplicating the same six lines.
export const FadeInView: React.FC<FadeInViewProps> = ({ children, duration = 250, style, translateY = 0 }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(translateY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration, useNativeDriver: true }),
    ]).start();
    // Intentionally run once on mount — callers that need to replay the
    // animation (e.g. per navigation step) rely on remounting via a `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY: translate }] }]}>
      {children}
    </Animated.View>
  );
};
