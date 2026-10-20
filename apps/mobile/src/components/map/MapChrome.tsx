import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import List from "lucide-react-native/icons/list";
import MapIcon from "lucide-react-native/icons/map";
import LocateFixed from "lucide-react-native/icons/locate-fixed";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens } from "../../theme/glass";
import { playHaptic } from "../../utils/haptics";

/** Размываем то, что лежит под стеклом (web); на native — полупрозрачность поверх карты. */
const frosted = Platform.OS === "web" ? ({ backdropFilter: "blur(16px) saturate(1.3)" } as ViewStyle) : null;

function useGlassSurface() {
  const theme = useTheme();
  const g = glassTokens(theme.mode, "plain");
  return {
    theme,
    surface: {
      backgroundColor: theme.mode === "dark" ? "rgba(18,26,25,0.82)" : "rgba(255,255,255,0.86)",
      borderColor: g.border,
      borderWidth: 1,
      boxShadow: theme.mode === "dark" ? "0 6px 20px rgba(0,0,0,0.45)" : "0 6px 20px rgba(22,32,30,0.14)",
    } as ViewStyle,
  };
}

interface MapTopBarProps {
  count: number;
  /** Показан список (а не карта): кнопка справа возвращает к карте. */
  listMode: boolean;
  onToggle: () => void;
  topInset: number;
}

/**
 * Плавающая шапка поверх карты: слева название и число предложений на стеклянной плашке, справа круглая кнопка
 * «карта ↔ список». Карта идёт под статус-бар (edge-to-edge) — шапка не отнимает у неё высоту.
 */
export function MapTopBar({ count, listMode, onToggle, topInset }: MapTopBarProps) {
  const { t } = useTranslation();
  const { theme, surface } = useGlassSurface();
  const Icon = listMode ? MapIcon : List;

  return (
    <View style={[styles.topBar, { top: topInset + 8 }]} pointerEvents="box-none">
      <View style={[styles.titlePill, surface, frosted, { borderRadius: theme.radii.lg }]} accessibilityRole="header">
        <Text style={[theme.fonts.bold, styles.title, { color: theme.colors.text }]}>{t("map.title")}</Text>
        <Text style={[styles.count, { color: theme.colors.textMuted }]}>{t("map.offersCount", { count })}</Text>
      </View>
      <Pressable
        onPress={() => {
          playHaptic("select");
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={listMode ? t("map.showMap") : t("map.showList")}
        style={({ pressed }) => [styles.round, surface, frosted, { opacity: pressed ? 0.85 : 1, cursor: "pointer" } as ViewStyle]}
      >
        <Icon size={20} color={theme.colors.text} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

interface MapLocateButtonProps {
  /** Позиция человека известна (разрешение есть, это не запасной центр города). */
  located: boolean;
  loading?: boolean;
  onPress: () => void;
  /** Отступ снизу — над лентой карточек. */
  bottom: number;
}

/** Круглая кнопка у большого пальца: определить меня / вернуться к себе. */
export function MapLocateButton({ located, loading = false, onPress, bottom }: MapLocateButtonProps) {
  const { t } = useTranslation();
  const { theme, surface } = useGlassSurface();

  return (
    <Pressable
      onPress={() => {
        playHaptic("tap");
        onPress();
      }}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={located ? t("map.recenter") : t("map.locate")}
      style={({ pressed }) => [
        styles.locate,
        surface,
        frosted,
        { bottom, opacity: pressed ? 0.85 : 1, cursor: loading ? "default" : "pointer" } as ViewStyle,
        located && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <LocateFixed size={22} color={located ? theme.colors.onPrimary : theme.colors.text} strokeWidth={2.3} />}
    </Pressable>
  );
}

/** Вместо ленты, когда предложений нет: карта остаётся, а внизу — спокойное объяснение. */
export function MapEmptyCard({ bottom }: { bottom: number }) {
  const { t } = useTranslation();
  const { theme, surface } = useGlassSurface();
  return (
    <View style={[styles.empty, surface, frosted, { bottom, borderRadius: theme.radii.lg }]}>
      <Text style={[theme.fonts.bold, styles.emptyTitle, { color: theme.colors.text }]}>{t("map.empty")}</Text>
      <Text style={[styles.emptyHint, { color: theme.colors.textMuted }]}>{t("map.emptyHint")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 5 },
  titlePill: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  title: { fontSize: 17, letterSpacing: -0.2 },
  count: { fontSize: 12.5, fontWeight: "600" },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  locate: { position: "absolute", right: 14, width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", zIndex: 5 },
  empty: { position: "absolute", left: 12, right: 12, padding: 16, gap: 4, zIndex: 5 },
  emptyTitle: { fontSize: 15 },
  emptyHint: { fontSize: 13, lineHeight: 18 },
});
