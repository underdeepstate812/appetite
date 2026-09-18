import React, { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { AppetiteMark } from "../../components/icons/AppetiteMark";
import { formatRuPhoneInput, getPasswordError, isValidPhone } from "../../utils/validation";
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
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordError = touched ? getPasswordError(password) : null;
  const phoneError = touched && phone.length > 0 && !isValidPhone(phone) ? "Формат: +7XXXXXXXXXX" : null;
  const canSubmit = name.trim().length >= 2 && getPasswordError(password) === null && (phone.length === 0 || isValidPhone(phone));

  const handleSubmit = async () => {
    setTouched(true);
    setError(null);
    if (!canSubmit) return;
    try {
      await register({ name, email, password, phone: phone || undefined });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("common.error"));
    }
  };

  return (
    <Screen scroll>
      <View style={styles.brandRow}>
        <AppetiteMark size={40} />
      </View>
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
        onChangeText={(value) => setPhone(value.length ? formatRuPhoneInput(value) : "")}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        error={phoneError ?? undefined}
      />
      <TextField
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        error={passwordError ?? undefined}
      />

      {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}

      <Button title={t("auth.registerButton")} onPress={handleSubmit} loading={isLoading} disabled={touched && !canSubmit} />

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
  brandRow: { alignItems: "center", marginTop: 24, marginBottom: 8 },
  title: { marginBottom: 24 },
  error: { marginBottom: 12, fontSize: 13 },
  link: { marginTop: 20, textAlign: "center", fontSize: 14 },
});
