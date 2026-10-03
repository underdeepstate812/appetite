import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { heatColor } from "../theme/heat";
import { getTimeLeft, getUrgencyRatio } from "../utils/time";
import { useNow } from "../hooks/useNow";

/** Чем больше скидка, тем крупнее пин и заметнее пульсирующее кольцо — та же логика тиров, что в LeafletMapView (web), выражена через RN Animated вместо CSS keyframes. */
function pinTierFor(discountPercent: number) {
  if (discountPercent >= 50) return { dot: 22, ringMax: 2.6, duration: 1400 };
  if (discountPercent >= 30) return { dot: 18, ringMax: 2.1, duration: 1900 };
  return { dot: 14, ringMax: 1.7, duration: 2600 };
}

export function PulsingMapPin({ discountPercent, pickupEnd }: { discountPercent: number; pickupEnd: string }) {
  const theme = useTheme();
  const now = useNow();
  const tier = pinTierFor(discountPercent);
  // Цвет — от оставшегося времени (шкала "жара", как у OfferCard/FuseTimer/LeafletMapView),
  // размер/скорость пульса — отдельно, от величины скидки (pinTierFor).
  const dotColor = heatColor(getUrgencyRatio(getTimeLeft(pickupEnd, now)), theme.mode);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: tier.duration, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, tier.duration]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, tier.ringMax] });
  const opacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.45, 0.08, 0] });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: tier.dot,
            height: tier.dot,
            borderRadius: tier.dot / 2,
            backgroundColor: dotColor,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            width: tier.dot,
            height: tier.dot,
            borderRadius: tier.dot / 2,
            backgroundColor: dotColor,
            borderColor: theme.colors.background,
          },
        ]}
      />
      <View style={[styles.label, { backgroundColor: theme.colors.surfaceElevated }]}>
        <Text style={[styles.labelText, { color: theme.colors.text }]}>−{discountPercent}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  ring: { position: "absolute" },
  dot: { borderWidth: 2 },
  label: { marginTop: 2, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  labelText: { fontSize: 11, fontWeight: "700" },
});
