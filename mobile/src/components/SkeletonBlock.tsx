import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle, StyleProp, DimensionValue } from "react-native";

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

// A pulsing placeholder block — used instead of a bare ActivityIndicator so a
// loading list/card reads as "content is arriving here" rather than a blank
// screen with a spinner. Opacity-pulse rather than a gradient sweep, so it
// needs no extra dependency.
export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: "#94A3B8", opacity: pulse },
        style,
      ]}
    />
  );
};
