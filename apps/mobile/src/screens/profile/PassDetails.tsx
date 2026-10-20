import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Lock from "lucide-react-native/icons/lock";
import Pencil from "lucide-react-native/icons/pencil";
import { usersApi } from "../../api/users";
import { ApiError } from "../../api/client";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { isValidEmail } from "../../utils/validation";

const MIN_NAME_LENGTH = 2;

/**
 * Корешок пропуска с контактами: просмотр или редактирование на месте. Телефон в форму
 * не входит совсем — он обязателен для входа и заказов, backend его не принимает.
 */
export function PassDetails() {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const nameError = touched && name.trim().length < MIN_NAME_LENGTH ? t("profile.nameTooShort") : undefined;
  const emailError = touched && !isValidEmail(email) ? t("profile.emailInvalid") : undefined;

  const startEditing = () => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setTouched(false);
    setSaveError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setTouched(true);
    if (name.trim().length < MIN_NAME_LENGTH || !isValidEmail(email)) return;

    // Шлём только изменённое.
    const changes: { name?: string; email?: string } = {};
    if (name.trim() !== user?.name) changes.name = name.trim();
    if (email.trim() !== user?.email) changes.email = email.trim();
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      setUser(await usersApi.updateProfile(changes));
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : t("profile.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const phone = (
    <View style={styles.field}>
      <Text style={[styles.overline, { color: theme.colors.textMuted }]}>{t("profile.phoneLabel").toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: editing || !user?.phone ? theme.colors.textMuted : theme.colors.text }]}>{user?.phone ?? t("profile.phoneEmpty")}</Text>
        {/* Замок с подписью: ясно, почему поле не редактируется (номер — часть входа), а не «сломано». Нет номера — нечего «привязывать». */}
        {user?.phone ? (
          <View style={[styles.lockChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Lock size={11} color={theme.colors.textMuted} strokeWidth={2.4} />
            <Text style={[styles.lockText, { color: theme.colors.textMuted }]}>{t("profile.phoneKept")}</Text>
          </View>
        ) : null}
      </View>
      {editing ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>{t("profile.phoneLocked")}</Text>
      ) : null}
    </View>
  );

  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.overline, { color: theme.colors.textMuted }]}>{t("profile.editTitle").toUpperCase()}</Text>
        {editing ? null : (
          <Pressable
            onPress={startEditing}
            accessibilityRole="button"
            accessibilityLabel={t("profile.edit")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            style={({ pressed }) => [styles.editLink, { opacity: pressed ? 0.6 : 1, cursor: "pointer" }]}
          >
            <Pencil size={13} color={theme.colors.primary} strokeWidth={2.4} />
            <Text style={[styles.editText, { color: theme.colors.primary, textDecorationColor: theme.colors.primary }]}>{t("profile.edit")}</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View>
          <TextField
            label={t("profile.nameLabel")}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            error={nameError}
          />
          <TextField
            label={t("profile.emailLabel")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={emailError}
          />
          {phone}

          {saveError ? (
            <Text style={[theme.typography.caption, { color: theme.colors.danger, marginBottom: theme.spacing.sm }]}>{saveError}</Text>
          ) : null}

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button title={t("profile.cancel")} variant="secondary" onPress={cancelEditing} disabled={saving} haptic="none" />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={saving ? t("profile.saving") : t("profile.save")}
                onPress={() => void handleSave()}
                loading={saving}
                haptic="success"
              />
            </View>
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.field}>
            <Text style={[styles.overline, { color: theme.colors.textMuted }]}>{t("profile.emailLabel").toUpperCase()}</Text>
            <Text style={[styles.value, { color: theme.colors.text }]} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          {phone}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, minHeight: 32 },
  overline: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.3 },
  editLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  editText: { fontSize: 13, fontWeight: "700", textDecorationLine: "underline", textDecorationStyle: "dashed" },
  field: { marginBottom: 14 },
  valueRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 3 },
  value: { fontSize: 16, fontWeight: "600", marginTop: 3, letterSpacing: 0.1 },
  lockChip: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  lockText: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.2 },
  actions: { flexDirection: "row", gap: 12, marginTop: 4 },
});
