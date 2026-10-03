import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Monitor from "lucide-react-native/icons/monitor";
import Moon from "lucide-react-native/icons/moon";
import Sun from "lucide-react-native/icons/sun";
import { useTheme } from "../../theme/ThemeProvider";
import { useThemeModeStore, type ThemeModeOverride } from "../../store/themeStore";
import { useLanguageStore } from "../../store/languageStore";
import type { SupportedLocale } from "../../i18n";
import { SlideSwitch, type SlideSwitchOption } from "../../components/SlideSwitch";

/** Тема и язык — две строки "подпись слева, значковый переключатель справа" вместо двух широких сегментных лент. */
export function SettingsPanel() {
  const { t } = useTranslation();
  const theme = useTheme();
  const themeOverride = useThemeModeStore((state) => state.override);
  const setThemeOverride = useThemeModeStore((state) => state.setOverride);
  const locale = useLanguageStore((state) => state.locale);
  const setLocale = useLanguageStore((state) => state.setLocale);

  const themeLabels: Record<ThemeModeOverride, string> = {
    system: t("profile.themeSystem"),
    light: t("profile.themeLight"),
    dark: t("profile.themeDark"),
  };
  const themeOptions: SlideSwitchOption<ThemeModeOverride>[] = [
    { value: "system", accessibilityLabel: themeLabels.system, render: (color) => <Monitor size={17} color={color} strokeWidth={2.2} /> },
    { value: "light", accessibilityLabel: themeLabels.light, render: (color) => <Sun size={17} color={color} strokeWidth={2.2} /> },
    { value: "dark", accessibilityLabel: themeLabels.dark, render: (color) => <Moon size={17} color={color} strokeWidth={2.2} /> },
  ];

  const languageLabels: Record<SupportedLocale, string> = { ru: t("profile.languageRu"), en: t("profile.languageEn") };
  const languageOptions: SlideSwitchOption<SupportedLocale>[] = (["ru", "en"] as const).map((value) => ({
    value,
    accessibilityLabel: languageLabels[value],
    render: (color: string) => <Text style={[styles.code, { color }]}>{value.toUpperCase()}</Text>,
  }));

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.overline, { color: theme.colors.textMuted }]}>{t("profile.settingsTitle").toUpperCase()}</Text>

      <View style={styles.row}>
        <View style={styles.labels}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t("profile.themeLabel")}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{themeLabels[themeOverride]}</Text>
        </View>
        <SlideSwitch options={themeOptions} value={themeOverride} onChange={(mode) => void setThemeOverride(mode)} />
      </View>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <View style={styles.row}>
        <View style={styles.labels}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t("profile.languageLabel")}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{languageLabels[locale]}</Text>
        </View>
        <SlideSwitch options={languageOptions} value={locale} onChange={(value) => void setLocale(value)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  overline: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.3, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  labels: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  code: { fontSize: 13, fontWeight: "800", letterSpacing: 0.6 },
});
