import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import type { EcoSummary } from "@apetite/shared";
import { ecoApi } from "../../api/eco";
import { useTheme } from "../../theme/ThemeProvider";
import Earth from "lucide-react-native/icons/earth";
import Package from "lucide-react-native/icons/package";
import Sprout from "lucide-react-native/icons/sprout";
import Trophy from "lucide-react-native/icons/trophy";
import { heatColor } from "../../theme/heat";
import { useCountUp } from "../../hooks/useCountUp";
import { Screen } from "../../components/Screen";
import { LoadingView, ErrorView } from "../../components/StateViews";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"EcoProfile">;

// Векторные значки вместо эмодзи из ECO_LEVELS (🌱🥡🌍🏆) — по id уровня.
const LEVEL_ICON = { 1: Sprout, 2: Package, 3: Earth, 4: Trophy } as const;

function Stat({ value, decimals, label, color }: { value: number; decimals: number; label: string; color: string }) {
  const theme = useTheme();
  const shown = useCountUp(value);
  return (
    <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[theme.fonts.heavy, styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {shown.toFixed(decimals)}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: "center" }]}>{label}</Text>
    </View>
  );
}

export function EcoProfileScreen(_props: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [summary, setSummary] = useState<EcoSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      ecoApi
        .me()
        .then((data) => {
          if (!cancelled) setSummary(data);
        })
        .catch((loadError) => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : t("common.error"));
        });
      return () => {
        cancelled = true;
      };
    }, [t, reloadKey])
  );

  if (error) {
    return (
      <Screen>
        <ErrorView label={error} onRetry={() => setReloadKey((key) => key + 1)} />
      </Screen>
    );
  }

  if (!summary) {
    return (
      <Screen>
        <LoadingView label={t("common.loading")} />
      </Screen>
    );
  }

  const { level, nextLevel, totalPoints } = summary;
  const LevelIcon = LEVEL_ICON[level.id as keyof typeof LEVEL_ICON];
  const progressToNext = nextLevel
    ? Math.min(1, Math.max(0, (totalPoints - level.minPoints) / (nextLevel.minPoints - level.minPoints)))
    : 1;
  const fuse = heatColor(progressToNext * 0.7, theme.mode);

  return (
    <Screen scroll>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.lg }]}>
        {t("eco.title")}
      </Text>

      <View style={[styles.levelCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={[styles.levelBadge, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }]}>
          <LevelIcon size={30} color={theme.colors.primary} strokeWidth={1.9} />
        </View>
        <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
          {t(`eco.levelNames.${level.id}`)}
        </Text>

        {nextLevel ? (
          <>
            <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
              <View style={[styles.progressFill, { width: `${progressToNext * 100}%`, backgroundColor: fuse }]}>
                <View style={[styles.spark, { backgroundColor: fuse, boxShadow: `0 0 9px 2px ${fuse}aa` }]} />
              </View>
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: theme.spacing.sm }]}>
              {t("eco.nextLevelProgress", { points: nextLevel.minPoints - totalPoints })}
            </Text>
          </>
        ) : (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: theme.spacing.sm }]}>
            {t("eco.maxLevelReached")}
          </Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <Stat value={summary.totalPoints} decimals={0} label={t("eco.totalPointsLabel")} color={theme.colors.primary} />
        <Stat value={summary.totalWeightSavedKg} decimals={1} label={t("eco.totalWeightLabel")} color={theme.colors.secondary} />
        <Stat value={summary.ordersCompleted} decimals={0} label={t("eco.ordersLabel")} color={theme.colors.text} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  levelCard: { alignItems: "center", padding: 24, borderRadius: 28, borderWidth: 1 },
  levelBadge: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  progressTrack: { width: "100%", height: 6, borderRadius: 3, marginTop: 18 },
  progressFill: { height: 6, borderRadius: 3, justifyContent: "center", alignItems: "flex-end" },
  spark: { width: 10, height: 10, borderRadius: 5, marginRight: -5 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statCard: { flex: 1, alignItems: "center", padding: 16, borderRadius: 22, borderWidth: 1 },
  statValue: { fontSize: 22, letterSpacing: -0.5, marginBottom: 2 },
});
