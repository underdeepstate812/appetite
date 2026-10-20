import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { buildSparks, SPARK_COLORS, SPARK_KEYS, SPARK_LIFE_MS } from "../utils/sparks";

interface SparkBurstProps {
  count?: number;
  /** Через сколько мс после монтирования вылетают искры. */
  delay?: number;
  seed?: number;
  onDone?: () => void;
}

/**
 * Искры из центра: поднимаются веером вверх и гаснут (не падают, как конфетти). Один мастер
 * Animated.Value на все частицы, у каждой по три interpolate по заранее посчитанным кадрам —
 * дёшево даже на слабом Android. Слой не перехватывает касания; при "уменьшении движения"
 * не рисуется вовсе. Родитель задаёт положение центра (слой центрируется в нём).
 */
export function SparkBurst({ count = 24, delay = 0, seed = 0, onDone }: SparkBurstProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const master = useRef(new Animated.Value(0)).current;
  const sparks = useMemo(() => buildSparks(count, seed), [count, seed]);
  const palette = SPARK_COLORS[theme.mode];

  useEffect(() => {
    if (reduced) {
      onDone?.();
      return;
    }
    const animation = Animated.timing(master, { toValue: 1, duration: SPARK_LIFE_MS, delay, easing: Easing.linear, useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => animation.stop();
    // Играется один раз на монтирование.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const nodes = useMemo(
    () =>
      sparks.map((spark) => ({
        spark,
        translateX: master.interpolate({ inputRange: [...SPARK_KEYS], outputRange: spark.x }),
        translateY: master.interpolate({ inputRange: [...SPARK_KEYS], outputRange: spark.y }),
        opacity: master.interpolate({ inputRange: [...SPARK_KEYS], outputRange: spark.opacity }),
        scale: master.interpolate({ inputRange: [0, 1], outputRange: [1, spark.scaleEnd] }),
      })),
    [master, sparks]
  );

  if (reduced) return null;

  return (
    <View style={styles.layer} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {nodes.map(({ spark, translateX, translateY, opacity, scale }, index) => (
        <Animated.View
          key={index}
          style={{
            position: "absolute",
            width: spark.length,
            height: spark.thickness,
            marginLeft: -spark.length / 2,
            marginTop: -spark.thickness / 2,
            borderRadius: spark.thickness / 2,
            backgroundColor: palette[spark.colorIndex],
            opacity,
            transform: [{ translateX }, { translateY }, { rotate: `${spark.angleDeg}deg` }, { scale }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Нулевой размер в центре родителя: искры позиционируются от его центра.
  layer: { position: "absolute", left: "50%", top: "50%", width: 0, height: 0 },
});
