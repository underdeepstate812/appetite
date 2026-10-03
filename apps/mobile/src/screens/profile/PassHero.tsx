import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import Camera from "lucide-react-native/icons/camera";
import { usersApi } from "../../api/users";
import { ApiError, resolveAssetUrl } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { useTheme } from "../../theme/ThemeProvider";
import { PASS_INK, PASS_INK_SOFT, PASS_MINT } from "./PassCard";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING = 108;
const STROKE = 4;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AVATAR = 88;

/**
 * "сентября 2026" / "September 2026". Месяц берём из полной даты (с днём): без дня русская
 * локаль отдаёт именительный падеж ("сентябрь"), и фраза "С нами с сентябрь 2026" ломается.
 */
function formatMemberSince(iso: string, locale: string): string {
  const date = new Date(iso);
  const tag = locale === "ru" ? "ru-RU" : "en-US";
  try {
    const parts = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric" }).formatToParts(date);
    const month = parts.find((part) => part.type === "month")?.value;
    const year = parts.find((part) => part.type === "year")?.value;
    if (month && year) return `${month} ${year}`;
  } catch {
    // Intl может быть неполным на старых движках — падаем на обычное форматирование.
  }
  return date.toLocaleDateString(tag, { month: "long", year: "numeric" });
}

interface PassHeroProps {
  levelName?: string;
  /** 0..1 — прогресс до следующего уровня; рисуется дугой вокруг фото. */
  levelProgress?: number;
}

/**
 * Лицевая часть пропуска: круглое фото, обведённое дугой прогресса до следующего уровня (как
 * кольцо активности), имя крупно, над ним — уровень. Дуга "нагревается": градиент от мяты к
 * янтарю, на конце горит искра. Здесь же — выбор и загрузка аватара (права галереи, квадратный
 * кроп, ошибка, fallback на инициал).
 */
export function PassHero({ levelName, levelProgress = 0 }: PassHeroProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Файл аватара мог пропасть/не загрузиться — тогда показываем инициал, а не пустой круг.
  const [loadFailed, setLoadFailed] = useState(false);

  const uri = resolveAssetUrl(user?.avatarUrl);
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    setLoadFailed(false);
  }, [uri]);

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: Math.min(1, Math.max(0, levelProgress)), duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [levelProgress, progress]);
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE, 0] });
  // Голова дуги: угол от 12 часов по часовой стрелке.
  const headRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const handlePick = async () => {
    if (uploading) return;
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t("profile.avatarPermissionDenied"));
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

    setUploading(true);
    try {
      setUser(await usersApi.uploadAvatar(asset.uri, asset.mimeType));
    } catch (pickError) {
      setError(pickError instanceof ApiError ? pickError.message : t("profile.avatarError"));
    } finally {
      setUploading(false);
    }
  };

  const status = error ?? (uploading ? t("profile.avatarUploading") : null);

  return (
    <View>
      <View style={styles.row}>
        <Pressable
          onPress={() => void handlePick()}
          accessibilityRole="button"
          accessibilityLabel={t("profile.changeAvatar")}
          style={({ pressed }) => [styles.avatarWrap, { opacity: pressed ? 0.88 : 1, cursor: "pointer" }]}
        >
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="levelRing" x1="0" y1="0" x2={RING} y2={RING} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#99f6e4" />
                <Stop offset="0.6" stopColor="#5eead4" />
                <Stop offset="1" stopColor="#ffb45c" />
              </LinearGradient>
            </Defs>
            <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke="rgba(255,255,255,0.2)" strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              stroke="url(#levelRing)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              rotation={-90}
              origin={`${RING / 2}, ${RING / 2}`}
            />
          </Svg>
          <Animated.View style={[styles.headOrbit, { transform: [{ rotate: headRotate }] }]}>
            <View style={styles.head} />
          </Animated.View>

          <View style={styles.avatar}>
            {uri && !loadFailed ? (
              <Image source={{ uri }} style={styles.avatarImage} onError={() => setLoadFailed(true)} accessibilityIgnoresInvertColors />
            ) : (
              <Text style={[theme.fonts.heavy, styles.initial]}>{initial}</Text>
            )}
            {uploading ? (
              <View style={styles.overlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </View>

          <View style={styles.camera}>
            <Camera size={15} color="#0F766E" strokeWidth={2.4} />
          </View>
        </Pressable>

        <View style={styles.identity}>
          {levelName ? (
            <Text style={styles.overline} numberOfLines={1}>
              {levelName.toUpperCase()}
            </Text>
          ) : null}
          <Text style={[theme.fonts.bold, styles.name]} numberOfLines={2}>
            {user?.name}
          </Text>
          {user?.createdAt ? (
            <Text style={styles.since}>{t("profile.memberSince", { date: formatMemberSince(user.createdAt, i18n.language) })}</Text>
          ) : null}
        </View>
      </View>

      {status ? <Text style={[styles.status, error ? styles.statusError : null]}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: "#CCFBF1",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: AVATAR, height: AVATAR },
  initial: { fontSize: 34, color: "#0F766E" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.42)", alignItems: "center", justifyContent: "center" },
  // Орбита искры: слой размером с кольцо вращается, искра сидит на его верхней кромке.
  headOrbit: { position: "absolute", width: RING, height: RING, alignItems: "center" },
  head: { width: 9, height: 9, borderRadius: 5, marginTop: STROKE / 2 - 4.5, backgroundColor: "#ffe2b8", boxShadow: "0 0 10px 2px rgba(255,180,92,0.9)" },
  camera: {
    position: "absolute",
    right: 2,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
  },
  identity: { flex: 1, minWidth: 0 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6, color: PASS_MINT },
  name: { fontSize: 20, lineHeight: 26, color: PASS_INK, marginTop: 4, letterSpacing: -0.4 },
  since: { fontSize: 13, color: PASS_INK_SOFT, marginTop: 6 },
  status: { fontSize: 13, color: PASS_INK_SOFT, marginTop: 14 },
  statusError: { color: "#FFD9D2" },
});
