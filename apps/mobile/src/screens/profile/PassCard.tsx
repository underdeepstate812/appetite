import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { AuroraBackdrop } from "../../components/AuroraBackdrop";

/** Цвета "печатной" части: одинаковы в обеих темах — это предмет, а не фон интерфейса. */
export const PASS_INK = "#FFFFFF";
export const PASS_INK_SOFT = "rgba(255,255,255,0.82)";
export const PASS_MINT = "#99F6E4";

const CARD_RADIUS = 26;
const INSET = 7;

/**
 * Профиль как карточка-пропуск: внутри белой (или тёмной) рамки лежит вставка со "светящимся"
 * фоном — героем профиля, а под ним корешок с данными. Вставка отступает от краёв на 7px и
 * имеет своё скругление — получается "карта в кармашке", а не плоский блок.
 */
export function PassCard({ hero, stub }: { hero: React.ReactNode; stub: React.ReactNode }) {
  const theme = useTheme();
  const shadow = theme.mode === "dark" ? "0 18px 36px rgba(0,0,0,0.55)" : "0 18px 36px rgba(15,118,110,0.14)";

  return (
    // Тень — на внешней обёртке: overflow:hidden на внутренней иначе срезает её на iOS.
    <View style={{ borderRadius: CARD_RADIUS, boxShadow: shadow }}>
      <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
        <View style={styles.hero}>
          <AuroraBackdrop />
          <View style={styles.heroContent}>{hero}</View>
        </View>
        <View style={styles.stub}>{stub}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_RADIUS, borderWidth: 1, padding: INSET, overflow: "hidden" },
  hero: { borderRadius: CARD_RADIUS - INSET, overflow: "hidden" },
  heroContent: { padding: 18, paddingBottom: 22 },
  stub: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 10 },
});
