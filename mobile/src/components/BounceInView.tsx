import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle, StyleProp } from "react-native";

interface BounceInViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

// Springs children in from 0 -> 1 scale. Used for moments that should feel
// like a small celebration (check-in/out success checkmark, an approved
// leave badge) rather than a plain fade.
export const BounceInView: React.FC<BounceInViewProps> = ({ children, style, delay = 0 }) => {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
};
