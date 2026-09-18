import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import Camera from "lucide-react-native/icons/camera";
import Lock from "lucide-react-native/icons/lock";
import Mail from "lucide-react-native/icons/mail";
import Pencil from "lucide-react-native/icons/pencil";
import Phone from "lucide-react-native/icons/phone";
import Sprout from "lucide-react-native/icons/sprout";
import type { EcoSummary } from "@apetite/shared";
import { ecoApi } from "../../api/eco";
import { usersApi } from "../../api/users";
import { ApiError, resolveAssetUrl } from "../../api/client";
import { useTheme } from "../../theme/ThemeProvider";
import { useThemeModeStore, ThemeModeOverride } from "../../store/themeStore";
import { useLanguageStore } from "../../store/languageStore";
import type { SupportedLocale } from "../../i18n";
import { useAuthStore } from "../../store/authStore";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { SegmentedControl } from "../../components/SegmentedControl";
import { isValidEmail } from "../../utils/validation";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Profile">;

const AVATAR_SIZE = 96;
const MIN_NAME_LENGTH = 2;

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export function ProfileScreen(_props: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const themeOverride = useThemeModeStore((state) => state.override);
  const setThemeOverride = useThemeModeStore((state) => state.setOverride);
  const locale = useLanguageStore((state) => state.locale);
  const setLocale = useLanguageStore((state) => state.setLocale);
  const [eco, setEco] = useState<EcoSummary | null>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // Файл аватара мог пропасть/не загрузиться — тогда показываем инициал, а не пустой круг.
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      ecoApi
        .me()
        .then((data) => {
          if (!cancelled) setEco(data);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const themeOptions: { value: ThemeModeOverride; label: string }[] = [
    { value: "system", label: t("profile.themeSystem") },
    { value: "light", label: t("profile.themeLight") },
    { value: "dark", label: t("profile.themeDark") },
  ];

  const languageOptions: { value: SupportedLocale; label: string }[] = [
    { value: "ru", label: t("profile.languageRu") },
    { value: "en", label: t("profile.languageEn") },
  ];

  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();
  const avatarUri = resolveAssetUrl(user?.avatarUrl);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUri]);

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

    // Шлём только изменённое — телефон в запрос не входит вообще (backend его не примет).
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
      const updated = await usersApi.updateProfile(changes);
      setUser(updated);
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : t("profile.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    if (avatarUploading) return;
    setAvatarError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError(t("profile.avatarPermissionDenied"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    setAvatarUploading(true);
    try {
      const updated = await usersApi.uploadAvatar(asset.uri, asset.mimeType);
      setUser(updated);
    } catch (error) {
      setAvatarError(error instanceof ApiError ? error.message : t("profile.avatarError"));
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.lg }]}>
        {t("profile.title")}
      </Text>

      <View style={[styles.heroCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
        <Pressable
          onPress={() => void handlePickAvatar()}
          accessibilityRole="button"
          accessibilityLabel={t("profile.changeAvatar")}
          style={styles.avatarWrap}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: theme.colors.primary, borderColor: theme.colors.primarySoft },
            ]}
          >
            {avatarUri && !avatarLoadFailed ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImage}
                onError={() => setAvatarLoadFailed(true)}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
            {avatarUploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </View>
          <View
            style={[
              styles.cameraBadge,
              { backgroundColor: theme.colors.primary, borderColor: theme.colors.surface },
            ]}
          >
            <Camera size={14} color="#fff" strokeWidth={2.2} />
          </View>
        </Pressable>
        {avatarError ? (
          <Text style={[theme.typography.caption, { color: theme.colors.danger, marginTop: theme.spacing.xs }]}>
            {avatarError}
          </Text>
        ) : (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: theme.spacing.xs }]}>
            {avatarUploading ? t("profile.avatarUploading") : t("profile.changeAvatar")}
          </Text>
        )}

        {editing ? null : (
          <>
            <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
              {user?.name}
            </Text>
            {user?.createdAt ? (
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {t("profile.memberSince", { date: formatMemberSince(user.createdAt) })}
              </Text>
            ) : null}
          </>
        )}

        {editing ? (
          <View style={[styles.editForm, { borderTopColor: theme.colors.border }]}>
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

            <View style={styles.lockedField}>
              <Text style={[styles.lockedLabel, { color: theme.colors.textMuted }]}>{t("profile.phoneLabel")}</Text>
              <View
                style={[
                  styles.lockedInput,
                  { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: theme.radii.sm },
                ]}
              >
                <Phone size={15} color={theme.colors.textMuted} strokeWidth={2} />
                <Text style={[theme.typography.body, { color: theme.colors.textMuted, flex: 1 }]}>
                  {user?.phone ?? "—"}
                </Text>
                <Lock size={14} color={theme.colors.textMuted} strokeWidth={2} />
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
                {t("profile.phoneLocked")}
              </Text>
            </View>

            {saveError ? (
              <Text style={[theme.typography.caption, { color: theme.colors.danger, marginBottom: theme.spacing.sm }]}>
                {saveError}
              </Text>
            ) : null}

            <View style={styles.editActions}>
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
          <>
            <View style={[styles.contactRow, styles.contactRowDivider, { borderTopColor: theme.colors.border }]}>
              <Mail size={15} color={theme.colors.textMuted} strokeWidth={2} />
              <Text style={[theme.typography.body, { color: theme.colors.text }]}>{user?.email}</Text>
            </View>
            {user?.phone ? (
              <View style={[styles.contactRow, { marginTop: 8 }]}>
                <Phone size={15} color={theme.colors.textMuted} strokeWidth={2} />
                <Text style={[theme.typography.body, { color: theme.colors.text, flex: 1 }]}>{user.phone}</Text>
                <Lock size={13} color={theme.colors.textMuted} strokeWidth={2} />
              </View>
            ) : null}

            <Pressable
              onPress={startEditing}
              accessibilityRole="button"
              accessibilityLabel={t("profile.edit")}
              style={[
                styles.editButton,
                { borderColor: theme.colors.primary, borderRadius: theme.radii.full },
              ]}
            >
              <Pencil size={14} color={theme.colors.primary} strokeWidth={2.2} />
              <Text style={[theme.typography.bodyBold, { color: theme.colors.primary }]}>{t("profile.edit")}</Text>
            </Pressable>
          </>
        )}
      </View>

      {eco ? (
        <View style={[styles.ecoCard, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.md }]}>
          <Sprout size={20} color={theme.colors.primary} strokeWidth={2} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[theme.typography.bodyBold, { color: theme.colors.text }]}>
              {t(`eco.levelNames.${eco.level.id}`)}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
              {t("profile.ecoTeaser", { points: eco.totalPoints, kg: eco.totalWeightSavedKg.toFixed(1) })}
            </Text>
          </View>
        </View>
      ) : null}

      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textMuted, marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs },
        ]}
      >
        {t("profile.themeLabel")}
      </Text>
      <SegmentedControl value={themeOverride} onChange={(mode) => void setThemeOverride(mode)} options={themeOptions} />

      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textMuted, marginTop: theme.spacing.lg, marginBottom: theme.spacing.xs },
        ]}
      >
        {t("profile.languageLabel")}
      </Text>
      <SegmentedControl value={locale} onChange={(value) => void setLocale(value)} options={languageOptions} />

      <View style={{ marginTop: theme.spacing.xl }}>
        <Button title={t("profile.logout")} variant="secondary" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: 20, alignItems: "center" },
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatarText: { fontSize: 38, fontWeight: "800", color: "#fff" },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  contactRowDivider: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    minHeight: 44,
  },
  editForm: { width: "100%", marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  editActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  lockedField: { marginBottom: 16 },
  lockedLabel: { fontSize: 13, marginBottom: 6 },
  lockedInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    opacity: 0.85,
  },
  ecoCard: { flexDirection: "row", alignItems: "center", padding: 16, marginTop: 16 },
});
