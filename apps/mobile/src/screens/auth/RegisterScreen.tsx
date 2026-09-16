import React, { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import type { AuthStackScreenProps } from "../../navigation/types";

type Props = AuthStackScreenProps<"Register">;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await register({ name, email, password, phone: phone || undefined });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("common.error"));
    }
  };

  return (
    <Screen scroll>
      <Text style={[styles.title, theme.typography.h1, { color: theme.colors.text }]}>
        {t("auth.registerTitle")}
      </Text>

      <TextField label={t("auth.name")} value={name} onChangeText={setName} textContentType="name" />
      <TextField
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t("auth.phone")}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
      />
      <TextField
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
      />

      {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}

      <Button title={t("auth.registerButton")} onPress={handleSubmit} loading={isLoading} />

      <Text
        accessibilityRole="button"
        onPress={() => navigation.navigate("Login")}
        style={[styles.link, { color: theme.colors.primary }]}
      >
        {t("auth.haveAccount")}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 24 },
  error: { marginBottom: 12, fontSize: 13 },
  link: { marginTop: 20, textAlign: "center", fontSize: 14 },
});
