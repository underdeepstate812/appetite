import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";
import { useUniqueId } from "../../hooks/useUniqueId";

/**
 * Фоновое свечение под стеклом: мятное пятно слева сверху и тёплое справа. Без цветного фона стеклянные
 * карточки читаются просто как «серые прямоугольники» — свету преломляться не в чём.
 * Не перехватывает касания и не участвует в доступности.
 */
export function GlowBackdrop() {
  const theme = useTheme();
  const dark = theme.mode === "dark";
  const mintId = useUniqueId("glowMint");
  const emberId = useUniqueId("glowEmber");
  const mint = dark ? "#2DD4BF" : "#0F766E";
  const ember = dark ? "#FF8A3D" : "#E8743B";

  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 400 520" preserveAspectRatio="xMidYMin slice">
        <Defs>
          <RadialGradient id={mintId} cx="0.15" cy="0.12" rx="0.75" ry="0.55" fx="0.15" fy="0.12">
            <Stop offset="0" stopColor={mint} stopOpacity={dark ? 0.34 : 0.2} />
            <Stop offset="1" stopColor={mint} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={emberId} cx="0.95" cy="0.55" rx="0.6" ry="0.5" fx="0.95" fy="0.55">
            <Stop offset="0" stopColor={ember} stopOpacity={dark ? 0.2 : 0.14} />
            <Stop offset="1" stopColor={ember} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="400" height="520" fill={`url(#${mintId})`} />
        <Rect width="400" height="520" fill={`url(#${emberId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, height: 520 },
});
