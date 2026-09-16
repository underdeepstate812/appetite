import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import type { EcoSummary } from "@apetite/shared";
import { ecoApi } from "../../api/eco";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { LoadingView, ErrorView } from "../../components/StateViews";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"EcoProfile">;

export function EcoProfileScreen(_props: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [summary, setSummary] = useState<EcoSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
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
    }, [t])
  );

  if (error) {
    return (
      <Screen>
        <ErrorView label={error} />
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
  const progressToNext = nextLevel
    ? Math.min(1, Math.max(0, (totalPoints - level.minPoints) / (nextLevel.minPoints - level.minPoints)))
    : 1;

  return (
    <Screen scroll>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.lg }]}>
        {t("eco.title")}
      </Text>

      <View style={[styles.levelCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}>
        <Text style={styles.levelIcon}>{level.icon}</Text>
        <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
          {t(`eco.levelNames.${level.id}`)}
        </Text>

        {nextLevel ? (
          <>
            <View
              style={[styles.progressTrack, { backgroundColor: theme.colors.border, borderRadius: theme.radii.full }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressToNext * 100}%`,
                    backgroundColor: theme.colors.secondary,
                    borderRadius: theme.radii.full,
                  },
                ]}
              />
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: theme.spacing.xs }]}>
              {t("eco.nextLevelProgress", { points: nextLevel.minPoints - totalPoints })}
            </Text>
          </>
        ) : (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: theme.spacing.xs }]}>
            {t("eco.maxLevelReached")}
          </Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}>
          <Text style={[theme.typography.h2, { color: theme.colors.primary }]}>{summary.totalPoints}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {t("eco.totalPointsLabel")}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}>
          <Text style={[theme.typography.h2, { color: theme.colors.secondary }]}>
            {summary.totalWeightSavedKg.toFixed(1)}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {t("eco.totalWeightLabel")}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}>
          <Text style={[theme.typography.h2, { color: theme.colors.text }]}>{summary.ordersCompleted}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{t("eco.ordersLabel")}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  levelCard: { alignItems: "center", padding: 24 },
  levelIcon: { fontSize: 48 },
  progressTrack: { width: "100%", height: 8, marginTop: 16, overflow: "hidden" },
  progressFill: { height: 8 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statCard: { flex: 1, alignItems: "center", padding: 16 },
});
