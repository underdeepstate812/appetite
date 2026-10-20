import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import { useTheme } from "../../theme/ThemeProvider";

/** «Показать пароль» — глазок внутри поля; цель нажатия 44×44 (минимум для пальца), не только иконка. */
export function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const Icon = visible ? EyeOff : Eye;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={visible ? t("auth.hidePassword") : t("auth.showPassword")}
      accessibilityState={{ selected: visible }}
      hitSlop={6}
      style={styles.hit}
    >
      <Icon size={20} color={visible ? theme.colors.primary : theme.colors.textMuted} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: 44, height: 44, alignItems: "center", justifyContent: "center", cursor: "pointer" } as object,
});
