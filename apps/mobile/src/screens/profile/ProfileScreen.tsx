import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import Mail from "lucide-react-native/icons/mail";
import Phone from "lucide-react-native/icons/phone";
import Sprout from "lucide-react-native/icons/sprout";
import type { EcoSummary } from "@apetite/shared";
import { ecoApi } from "../../api/eco";
import { useTheme } from "../../theme/ThemeProvider";
import { useThemeModeStore, ThemeModeOverride } from "../../store/themeStore";
import { useLanguageStore } from "../../store/languageStore";
import type { SupportedLocale } from "../../i18n";
import { useAuthStore } from "../../store/authStore";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { SegmentedControl } from "../../components/SegmentedControl";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Profile">;

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export function ProfileScreen(_props: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const themeOverride = useThemeModeStore((state) => state.override);
  const setThemeOverride = useThemeModeStore((state) => state.setOverride);
  const locale = useLanguageStore((state) => state.locale);
  const setLocale = useLanguageStore((state) => state.setLocale);
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

  const themeOptions: { value: ThemeModeOverride; label: string }[] = [
    { value: "system", label: t("profile.themeSystem") },
    { value: "light", label: t("profile.themeLight") },
    { value: "dark", label: t("profile.themeDark") },
  ];

  const languageOptions: { value: SupportedLocale; label: string }[] = [
    { value: "ru", label: t("profile.languageRu") },
    { value: "en", label: t("profile.languageEn") },
  ];

  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <Screen scroll>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.lg }]}>
        {t("profile.title")}
      </Text>

      <View style={[styles.heroCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary, borderRadius: theme.radii.full }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
          {user?.name}
        </Text>
        {user?.createdAt ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
            {t("profile.memberSince", { date: formatMemberSince(user.createdAt) })}
          </Text>
        ) : null}

        <View style={[styles.contactRow, styles.contactRowDivider, { borderTopColor: theme.colors.border }]}>
          <Mail size={15} color={theme.colors.textMuted} strokeWidth={2} />
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>{user?.email}</Text>
        </View>
        {user?.phone ? (
          <View style={[styles.contactRow, { marginTop: 8 }]}>
            <Phone size={15} color={theme.colors.textMuted} strokeWidth={2} />
            <Text style={[theme.typography.body, { color: theme.colors.text }]}>{user.phone}</Text>
          </View>
        ) : null}
      </View>

      {eco ? (
        <View style={[styles.ecoCard, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.md }]}>
          <Sprout size={20} color={theme.colors.primary} strokeWidth={2} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[theme.typography.bodyBold, { color: theme.colors.text }]}>
              {t(`eco.levelNames.${eco.level.id}`)}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
              {t("profile.ecoTeaser", { points: eco.totalPoints, kg: eco.totalWeightSavedKg.toFixed(1) })}
            </Text>
          </View>
        </View>
      ) : null}

      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textMuted, marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs },
        ]}
      >
        {t("profile.themeLabel")}
      </Text>
      <SegmentedControl value={themeOverride} onChange={(mode) => void setThemeOverride(mode)} options={themeOptions} />

      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textMuted, marginTop: theme.spacing.lg, marginBottom: theme.spacing.xs },
        ]}
      >
        {t("profile.languageLabel")}
      </Text>
      <SegmentedControl value={locale} onChange={(value) => void setLocale(value)} options={languageOptions} />

      <View style={{ marginTop: theme.spacing.xl }}>
        <Button title={t("profile.logout")} variant="secondary" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: 20, alignItems: "center" },
  avatar: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 26, fontWeight: "800", color: "#fff" },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  contactRowDivider: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  ecoCard: { flexDirection: "row", alignItems: "center", padding: 16, marginTop: 16 },
});
