import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
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

export function ProfileScreen(_props: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const themeOverride = useThemeModeStore((state) => state.override);
  const setThemeOverride = useThemeModeStore((state) => state.setOverride);
  const locale = useLanguageStore((state) => state.locale);
  const setLocale = useLanguageStore((state) => state.setLocale);

  const themeOptions: { value: ThemeModeOverride; label: string }[] = [
    { value: "system", label: t("profile.themeSystem") },
    { value: "light", label: t("profile.themeLight") },
    { value: "dark", label: t("profile.themeDark") },
  ];

  const languageOptions: { value: SupportedLocale; label: string }[] = [
    { value: "ru", label: t("profile.languageRu") },
    { value: "en", label: t("profile.languageEn") },
  ];

  return (
    <Screen>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.lg }]}>
        {t("profile.title")}
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}>
        <Text style={[theme.typography.bodyBold, { color: theme.colors.text }]}>{user?.name}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>{user?.email}</Text>
        {user?.phone ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
            {user.phone}
          </Text>
        ) : null}
      </View>

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
  card: { padding: 16 },
});
