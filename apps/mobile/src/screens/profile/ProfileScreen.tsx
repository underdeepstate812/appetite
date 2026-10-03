import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import LogOut from "lucide-react-native/icons/log-out";
import type { EcoSummary } from "@apetite/shared";
import { ecoApi } from "../../api/eco";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { Screen } from "../../components/Screen";
import { StaggerReveal } from "../../components/StaggerReveal";
import { AppetiteMark } from "../../components/icons/AppetiteMark";
import { PassCard } from "./PassCard";
import { PassHero } from "./PassHero";
import { PassStats } from "./PassStats";
import { PassDetails } from "./PassDetails";
import { EcoRoute } from "./EcoRoute";
import { SettingsPanel } from "./SettingsPanel";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Profile">;

/** С этой ширины пропуск и остальное встают в две колонки — пропуск не растягивается на весь экран. */
const WIDE_BREAKPOINT = 880;

/**
 * Профиль — "пропуск спасателя еды": фото, имя, уровень и контакты собраны в один
 * билет с линией отрыва (PassCard), ниже — маршрут по уровням эко-профиля и компактные
 * настройки. Вся прежняя функциональность (аватар, правка имени/email, тема, язык,
 * выход) сохранена, телефон по-прежнему нередактируем.
 */
export function ProfileScreen(_props: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const [eco, setEco] = useState<EcoSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      ecoApi
        .me()
        .then((data) => {
          if (!cancelled) setEco(data);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Прогресс до следующего уровня — дугой вокруг фото (на максимальном уровне дуга полная).
  const levelProgress = eco
    ? eco.nextLevel
      ? Math.min(1, Math.max(0, (eco.totalPoints - eco.level.minPoints) / (eco.nextLevel.minPoints - eco.level.minPoints)))
      : 1
    : 0;

  const pass = (
    <StaggerReveal index={1}>
      <PassCard
        hero={<PassHero levelName={eco ? t(`eco.levelNames.${eco.level.id}`) : undefined} levelProgress={levelProgress} />}
        stub={
          <>
            <PassStats eco={eco} />
            <PassDetails />
          </>
        }
      />
    </StaggerReveal>
  );

  const side = (
    <>
      {eco ? (
        <View style={styles.block}>
          <StaggerReveal index={2}>
            <EcoRoute summary={eco} />
          </StaggerReveal>
        </View>
      ) : null}
      <View style={styles.block}>
        <StaggerReveal index={3}>
          <SettingsPanel />
        </StaggerReveal>
      </View>
      <StaggerReveal index={4}>
        <Pressable
          onPress={() => void logout()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.logout, { borderTopColor: theme.colors.border, opacity: pressed ? 0.6 : 1, cursor: "pointer" }]}
        >
          <LogOut size={16} color={theme.colors.textMuted} strokeWidth={2.2} />
          <Text style={[styles.logoutText, { color: theme.colors.textMuted }]}>{t("profile.logout")}</Text>
        </Pressable>
      </StaggerReveal>
    </>
  );

  return (
    <Screen scroll>
      <View style={styles.page}>
        <StaggerReveal index={0}>
          <View style={styles.titleRow}>
            <AppetiteMark size={22} />
            <Text style={[theme.fonts.bold, styles.title, { color: theme.colors.text }]}>{t("profile.title").toUpperCase()}</Text>
          </View>
        </StaggerReveal>

        {wide ? (
          <View style={styles.wideRow}>
            <View style={styles.wideMain}>{pass}</View>
            <View style={styles.wideSide}>{side}</View>
          </View>
        ) : (
          <>
            <View style={styles.block}>{pass}</View>
            {side}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: 1040, alignSelf: "center", paddingBottom: 24 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  title: { fontSize: 12, letterSpacing: 2.4 },
  block: { marginBottom: 16 },
  wideRow: { flexDirection: "row", alignItems: "flex-start", gap: 28 },
  wideMain: { width: 420, flexShrink: 0 },
  wideSide: { flex: 1, maxWidth: 480 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logoutText: { fontSize: 15, fontWeight: "700" },
});
