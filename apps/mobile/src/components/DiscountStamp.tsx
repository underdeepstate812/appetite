import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { heatBand } from "../theme/heat";

/** Наклейки — физический предмет: цвет один в обеих темах, чернила почти чёрные (≥6:1 на любой). */
const STICKER_FILL = { warm: "#fbbf24", hot: "#ff8a3d", crit: "#ff5c4d" } as const;
const STICKER_INK = "#1a0b02";

/**
 * Скидка как наклейка-уценка: маленькая плашка с острыми углами (r5), наклон −4°, пунктирная
 * внутренняя рамка и "отклеенный" верхний блик. Цвет следует за жаром окончания предложения:
 * спокойное — фирменный бирюзовый, дальше янтарь → ember → красный (красный только у самых
 * последних минут). Единый знак скидки на карточке и на экране предложения. Без пламени.
 */
export function DiscountStamp({ percent, ratio = 0, tilt = -4 }: { percent: number; ratio?: number; tilt?: number }) {
  const theme = useTheme();
  const band = heatBand(ratio);
  const calm = band === "calm";
  const fill = calm ? theme.colors.primary : STICKER_FILL[band];
  const ink = calm ? theme.colors.onPrimary : STICKER_INK;

  return (
    <View
      style={[
        styles.stamp,
        {
          backgroundColor: fill,
          transform: [{ rotate: `${tilt}deg` }],
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 3px rgba(0,0,0,0.35)`,
        },
      ]}
    >
      <View pointerEvents="none" style={[styles.inner, { borderColor: `${ink}66` }]} />
      <Text style={[theme.fonts.bold, styles.text, { color: ink }]}>−{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, alignSelf: "flex-start" },
  inner: { position: "absolute", top: 1.5, left: 1.5, right: 1.5, bottom: 1.5, borderRadius: 3.5, borderWidth: 1, borderStyle: "dashed" },
  text: { fontSize: 11, lineHeight: 14, fontVariant: ["tabular-nums"] },
});
