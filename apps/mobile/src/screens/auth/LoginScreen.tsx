import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { AuthShell } from "../../components/auth/AuthShell";
import { AuthError } from "../../components/auth/AuthError";
import { AuthLink } from "../../components/auth/AuthLink";
import { PasswordToggle } from "../../components/auth/PasswordToggle";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { playHaptic } from "../../utils/haptics";
import { formatRuPhoneInput, isValidEmail, isValidPhone } from "../../utils/validation";
import type { AuthStackScreenProps } from "../../navigation/types";

type Props = AuthStackScreenProps<"Login">;
type LoginMode = "email" | "phone";
interface FieldErrors {
  identifier?: string;
  password?: string;
}

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [mode, setMode] = useState<LoginMode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+7");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const identifierRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const identifier = mode === "email" ? email.trim() : phone;

  const identifierError = (): string | undefined => {
    if (mode === "email") {
      if (email.trim().length === 0) return t("auth.emailRequired");
      return isValidEmail(email) ? undefined : t("auth.emailInvalid");
    }
    return isValidPhone(phone) ? undefined : t("auth.phoneInvalid");
  };

  const validate = (): FieldErrors => ({
    identifier: identifierError(),
    password: password.length === 0 ? t("auth.passwordRequired") : undefined,
  });

  const handleSubmit = async () => {
    if (isLoading) return;
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    // Кнопка не «мёртвая»: нажатие всегда отвечает — показывает, что именно не так, и ведёт к первому полю.
    if (found.identifier || found.password) {
      playHaptic("warning");
      (found.identifier ? identifierRef : passwordRef).current?.focus();
      return;
    }
    try {
      await login({ identifier, password });
    } catch (submitFailure) {
      playHaptic("error");
      setSubmitError(submitFailure instanceof Error ? submitFailure.message : t("common.error"));
    }
  };

  const switchMode = () => {
    setMode((current) => (current === "email" ? "phone" : "email"));
    setErrors((current) => ({ ...current, identifier: undefined }));
    setSubmitError(null);
    setTimeout(() => identifierRef.current?.focus(), 0);
  };

  return (
    <AuthShell tagline={t("auth.tagline")} onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
      <Text accessibilityRole="header" style={[theme.typography.h1, styles.title, { color: theme.colors.text }]}>
        {t("auth.loginTitle")}
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{t("auth.loginSubtitle")}</Text>

      {mode === "email" ? (
        <TextField
          ref={identifierRef}
          label={t("auth.email")}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (errors.identifier) setErrors((current) => ({ ...current, identifier: undefined }));
          }}
          onBlur={() => email.length > 0 && setErrors((current) => ({ ...current, identifier: identifierError() }))}
          placeholder="name@mail.ru"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
          error={errors.identifier}
        />
      ) : (
        <TextField
          ref={identifierRef}
          label={t("auth.phoneShort")}
          value={phone}
          onChangeText={(value) => {
            setPhone(formatRuPhoneInput(value));
            if (errors.identifier) setErrors((current) => ({ ...current, identifier: undefined }));
          }}
          onBlur={() => phone.length > 2 && setErrors((current) => ({ ...current, identifier: identifierError() }))}
          placeholder="+79001234567"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
          error={errors.identifier}
        />
      )}

      <TextField
        ref={passwordRef}
        label={t("auth.password")}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
        }}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void handleSubmit()}
        rightAccessory={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />}
        error={errors.password}
      />

      <Pressable onPress={switchMode} accessibilityRole="button" style={styles.switch}>
        <Text style={[styles.switchText, { color: theme.colors.primary }]}>{mode === "email" ? t("auth.viaPhone") : t("auth.viaEmail")}</Text>
      </Pressable>

      <View style={styles.spacer} />

      {submitError ? <AuthError message={submitError} /> : null}

      <Button title={t("auth.loginButton")} onPress={handleSubmit} loading={isLoading} arrow />

      <AuthLink prompt={t("auth.noAccountPrompt")} action={t("auth.createAccount")} onPress={() => navigation.navigate("Register")} />

      {/* Только dev-сборка: в продакшен-бандл эта ветка (и пароль) не попадает. */}
      {__DEV__ ? (
        <Pressable
          onPress={() => {
            setMode("email");
            setEmail("user@apetite.ru");
            setPassword("password123");
            setErrors({});
          }}
          accessibilityRole="button"
          style={styles.demo}
        >
          <Text style={[styles.demoText, { color: theme.colors.textMuted }]}>{t("auth.fillDemo")}</Text>
        </Pressable>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, lineHeight: 30 },
  subtitle: { fontSize: 14.5, lineHeight: 20, marginTop: 4, marginBottom: 20 },
  switch: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", marginTop: -4, cursor: "pointer" } as object,
  switchText: { fontSize: 14, fontWeight: "700" },
  spacer: { flexGrow: 1, minHeight: 12 },
  demo: { minHeight: 40, alignItems: "center", justifyContent: "center", marginTop: 4 },
  demoText: { fontSize: 12.5, textDecorationLine: "underline" },
});
