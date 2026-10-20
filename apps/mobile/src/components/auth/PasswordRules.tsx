import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Check from "lucide-react-native/icons/check";
import { useTheme } from "../../theme/ThemeProvider";
import { getPasswordChecks } from "../../utils/validation";

/**
 * Требования к паролю как чек-лист: все правила видны сразу и «загораются» по мере ввода, поэтому человек
 * не гадает, чего не хватает, и не получает по одной ошибке за попытку. Статус читается не только цветом
 * (галочка против точки) и озвучивается целиком одной фразой для скринридера.
 */
export function PasswordRules({ password }: { password: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const checks = getPasswordChecks(password);
  const done = checks.filter((check) => check.ok).length;
  const labels: Record<string, string> = {
    length: t("auth.ruleLength"),
    upper: t("auth.ruleUpper"),
    lower: t("auth.ruleLower"),
    digit: t("auth.ruleDigit"),
    symbol: t("auth.ruleSymbol"),
  };

  return (
    <View accessible accessibilityLabel={t("auth.rulesProgress", { done, total: checks.length })} style={styles.wrap}>
      <Text style={[styles.title, { color: theme.colors.textMuted }]}>{t("auth.passwordRulesTitle")}</Text>
      <View style={styles.chips}>
        {checks.map((check) => (
          <View
            key={check.key}
            style={[
              styles.chip,
              { backgroundColor: check.ok ? theme.colors.primarySoft : theme.colors.surface, borderRadius: theme.radii.sm },
            ]}
          >
            {check.ok ? (
              <Check size={13} color={theme.colors.primary} strokeWidth={3} />
            ) : (
              <View style={[styles.dot, { backgroundColor: theme.colors.textMuted }]} />
            )}
            <Text style={[styles.chipText, { color: check.ok ? theme.colors.primary : theme.colors.textMuted, fontWeight: check.ok ? "700" : "500" }]}>
              {labels[check.key]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: -2, marginBottom: 14 },
  title: { fontSize: 12.5, marginBottom: 8, marginLeft: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, opacity: 0.55, marginHorizontal: 4 },
  chipText: { fontSize: 12.5 },
});
