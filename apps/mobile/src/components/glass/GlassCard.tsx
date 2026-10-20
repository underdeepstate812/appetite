import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens, type GlassTone } from "../../theme/glass";
import { useUniqueId } from "../../hooks/useUniqueId";

interface GlassCardProps extends ViewProps {
  tone?: GlassTone;
  /** Свечение вокруг карточки; без него остаётся только мягкая тень. */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** На web размываем то, что лежит под карточкой; на native RN такого фильтра не умеет — там работает полупрозрачность поверх свечения фона. */
const frosted = Platform.OS === "web" ? ({ backdropFilter: "blur(16px) saturate(1.3)" } as ViewStyle) : null;

/**
 * Стеклянная карточка: полупрозрачная заливка, кромка тона, блик сверху и свечение.
 * Силуэт — обычный скруглённый (фирменный «срез» остаётся только за кнопками).
 */
export function GlassCard({ tone = "mint", glow = true, style, children, ...rest }: GlassCardProps) {
  const theme = useTheme();
  const g = glassTokens(theme.mode, tone);
  const sheenId = useUniqueId("glassSheen");

  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: g.fill, borderColor: g.border, borderRadius: theme.radii.lg, boxShadow: glow ? g.shadow : undefined },
        frosted,
        style,
      ]}
    >
      <Svg style={styles.sheen} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={g.sheen} />
            <Stop offset="0.55" stopColor={g.sheen} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${sheenId})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: "hidden", padding: 16 },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
