import React, { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { SegmentedControl } from "../../components/SegmentedControl";
import { AppetiteMark } from "../../components/icons/AppetiteMark";
import { formatRuPhoneInput, isValidEmail, isValidPhone } from "../../utils/validation";
import type { AuthStackScreenProps } from "../../navigation/types";

type Props = AuthStackScreenProps<"Login">;
type LoginMode = "email" | "phone";

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [mode, setMode] = useState<LoginMode>("email");
  // Демо-аккаунт подставляем только в dev-сборке: в продакшене поле пустое, а подсказка с паролем не показывается.
  const [email, setEmail] = useState(__DEV__ ? "user@apetite.ru" : "");
  const [phone, setPhone] = useState("+7");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const identifier = mode === "email" ? email : phone;
  const identifierValid = mode === "email" ? isValidEmail(email) : isValidPhone(phone);

  const handleSubmit = async () => {
    setError(null);
    try {
      await login({ identifier, password });
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

      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { value: "email", label: t("auth.email") },
          { value: "phone", label: t("auth.phoneShort") },
        ]}
      />

      <View style={{ marginTop: 16 }}>
        {mode === "email" ? (
          <TextField
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        ) : (
          <TextField
            label={t("auth.phoneShort")}
            value={phone}
            onChangeText={(value) => setPhone(formatRuPhoneInput(value))}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
        )}
      </View>
      <TextField
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
      />

      {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}

      <Button
        title={t("auth.loginButton")}
        onPress={handleSubmit}
        loading={isLoading}
        disabled={!identifierValid || password.length === 0}
      />

      <Text
        accessibilityRole="button"
        onPress={() => navigation.navigate("Register")}
        style={[styles.link, { color: theme.colors.primary }]}
      >
        {t("auth.noAccount")}
      </Text>

      {/* Только dev-сборка: в продакшен-бандл эта ветка (и пароль) не попадает. */}
      {__DEV__ ? <Text style={[styles.hint, { color: theme.colors.textMuted }]}>Demo: user@apetite.ru / password123</Text> : null}
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
