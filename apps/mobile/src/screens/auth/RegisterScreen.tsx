import React, { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { AuthShell } from "../../components/auth/AuthShell";
import { AuthError } from "../../components/auth/AuthError";
import { AuthLink } from "../../components/auth/AuthLink";
import { PasswordRules } from "../../components/auth/PasswordRules";
import { PasswordToggle } from "../../components/auth/PasswordToggle";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { playHaptic } from "../../utils/haptics";
import { formatRuPhoneInput, getPasswordError, isValidEmail, isValidPhone } from "../../utils/validation";
import type { AuthStackScreenProps } from "../../navigation/types";

type Props = AuthStackScreenProps<"Register">;
type FieldName = "name" | "email" | "phone" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const refs: Record<FieldName, React.RefObject<TextInput | null>> = {
    name: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    phone: useRef<TextInput>(null),
    password: useRef<TextInput>(null),
  };

  const check = (field: FieldName): string | undefined => {
    switch (field) {
      case "name":
        return name.trim().length >= 2 ? undefined : t("auth.nameTooShort");
      case "email":
        if (email.trim().length === 0) return t("auth.emailRequired");
        return isValidEmail(email) ? undefined : t("auth.emailInvalid");
      case "phone":
        // Телефон необязателен: пустой — нормально, проверяем только введённый.
        return phone.length === 0 || isValidPhone(phone) ? undefined : t("auth.phoneInvalid");
      case "password":
        if (password.length === 0) return t("auth.passwordRequired");
        return getPasswordError(password) === null ? undefined : t("auth.passwordWeak");
    }
  };

  const setFieldError = (field: FieldName, message: string | undefined) => setErrors((current) => ({ ...current, [field]: message }));
  const clearError = (field: FieldName) => errors[field] && setFieldError(field, undefined);
  const validateOnBlur = (field: FieldName, touched: boolean) => touched && setFieldError(field, check(field));

  const handleSubmit = async () => {
    if (isLoading) return;
    setSubmitError(null);
    const order: FieldName[] = ["name", "email", "phone", "password"];
    const found: FieldErrors = {};
    for (const field of order) found[field] = check(field);
    setErrors(found);
    const firstInvalid = order.find((field) => found[field]);
    if (firstInvalid) {
      playHaptic("warning");
      refs[firstInvalid].current?.focus();
      return;
    }
    try {
      await register({ name: name.trim(), email: email.trim(), password, phone: phone || undefined });
    } catch (submitFailure) {
      playHaptic("error");
      setSubmitError(submitFailure instanceof Error ? submitFailure.message : t("common.error"));
    }
  };

  return (
    <AuthShell tagline={t("auth.tagline")} compact onBack={navigation.canGoBack() ? navigation.goBack : undefined}>
      <Text accessibilityRole="header" style={[theme.typography.h1, styles.title, { color: theme.colors.text }]}>
        {t("auth.registerTitle")}
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{t("auth.registerSubtitle")}</Text>

      <TextField
        ref={refs.name}
        label={t("auth.name")}
        value={name}
        onChangeText={(value) => {
          setName(value);
          clearError("name");
        }}
        onBlur={() => validateOnBlur("name", name.length > 0)}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => refs.email.current?.focus()}
        blurOnSubmit={false}
        error={errors.name}
      />
      <TextField
        ref={refs.email}
        label={t("auth.email")}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          clearError("email");
        }}
        onBlur={() => validateOnBlur("email", email.length > 0)}
        placeholder="name@mail.ru"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => refs.phone.current?.focus()}
        blurOnSubmit={false}
        error={errors.email}
      />
      <TextField
        ref={refs.phone}
        label={t("auth.phone")}
        value={phone}
        onChangeText={(value) => {
          setPhone(value.length ? formatRuPhoneInput(value) : "");
          clearError("phone");
        }}
        onBlur={() => validateOnBlur("phone", phone.length > 2)}
        placeholder="+79001234567"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => refs.password.current?.focus()}
        blurOnSubmit={false}
        error={errors.phone}
      />
      <TextField
        ref={refs.password}
        label={t("auth.password")}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          clearError("password");
        }}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void handleSubmit()}
        rightAccessory={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />}
        error={errors.password}
        containerStyle={styles.passwordField}
      />
      <PasswordRules password={password} />

      <View style={styles.spacer} />

      {submitError ? <AuthError message={submitError} /> : null}

      <Button title={t("auth.registerButton")} onPress={handleSubmit} loading={isLoading} arrow />

      <AuthLink prompt={t("auth.haveAccountPrompt")} action={t("auth.signIn")} onPress={() => navigation.navigate("Login")} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, lineHeight: 30 },
  subtitle: { fontSize: 14.5, lineHeight: 20, marginTop: 4, marginBottom: 20 },
  passwordField: { marginBottom: 10 },
  spacer: { flexGrow: 1, minHeight: 12 },
});
