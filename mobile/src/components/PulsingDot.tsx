import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";

interface PulsingDotProps {
  color: string;
  size?: number;
}

// A dot with an expanding, fading ring — a "radar" cue for "actively
// searching" (GPS lock, reverse-geocode in flight), so those waits read as
// live progress instead of a static "—".
export const PulsingDot: React.FC<PulsingDotProps> = ({ color, size = 8 }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  const ringSize = size * 3;

  return (
    <View style={[styles.wrap, { width: ringSize, height: ringSize }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            backgroundColor: color,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
      <View style={[styles.core, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute" },
  core: {},
});
