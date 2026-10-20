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

/** selected — пин выбранного предложения: крупнее, с кольцом и тёмной плашкой скидки (в паре с карточкой в ленте под картой). */
export function PulsingMapPin({ discountPercent, pickupEnd, selected = false }: { discountPercent: number; pickupEnd: string; selected?: boolean }) {
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

  const size = selected ? tier.dot + 8 : tier.dot;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, tier.ringMax] });
  const opacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.45, 0.08, 0] });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
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
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: dotColor,
            borderColor: theme.colors.background,
          },
          selected && { boxShadow: `0 0 0 4px #ffffff, 0 0 0 7px ${dotColor}, 0 6px 16px rgba(0,0,0,0.35)` },
        ]}
      />
      <View style={[styles.label, { backgroundColor: selected ? theme.colors.text : theme.colors.surfaceElevated }, selected && styles.labelSelected]}>
        <Text style={[styles.labelText, { color: selected ? theme.colors.background : theme.colors.text }, selected && styles.labelTextSelected]}>−{discountPercent}%</Text>
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
  labelSelected: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 2 },
  labelTextSelected: { fontSize: 13 },
});
