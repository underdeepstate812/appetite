import React, { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { AppetiteMark } from "../../components/icons/AppetiteMark";
import type { AuthStackScreenProps } from "../../navigation/types";

type Props = AuthStackScreenProps<"Login">;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [email, setEmail] = useState("user@apetite.ru");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await login({ email, password });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("common.error"));
    }
  };

  return (
    <Screen scroll>
      <View style={styles.brandRow}>
        <AppetiteMark size={40} />
      </View>
      <Text style={[styles.title, theme.typography.h1, { color: theme.colors.text }]}>{t("auth.loginTitle")}</Text>

      <TextField
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
      />

      {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}

      <Button title={t("auth.loginButton")} onPress={handleSubmit} loading={isLoading} />

      <Text
        accessibilityRole="button"
        onPress={() => navigation.navigate("Register")}
        style={[styles.link, { color: theme.colors.primary }]}
      >
        {t("auth.noAccount")}
      </Text>

      <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{t("auth.demoHint")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: "center", marginTop: 24, marginBottom: 8 },
  title: { marginBottom: 24 },
  error: { marginBottom: 12, fontSize: 13 },
  link: { marginTop: 20, textAlign: "center", fontSize: 14 },
  hint: { marginTop: 40, textAlign: "center", fontSize: 12 },
});
