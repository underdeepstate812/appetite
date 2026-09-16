import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Profile">;

export function ProfileScreen(_props: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

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

      <View style={{ marginTop: theme.spacing.xl }}>
        <Button title={t("profile.logout")} variant="secondary" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
});
