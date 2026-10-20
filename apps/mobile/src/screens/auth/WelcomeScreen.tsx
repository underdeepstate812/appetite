import React from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { BUTTON_PULSE_PERIOD_MS, Button } from "../../components/Button";
import { StaggerReveal } from "../../components/StaggerReveal";
import { WelcomeArt } from "../../components/auth/WelcomeArt";
import { AppetiteMark } from "../../components/icons/AppetiteMark";
import { useUniqueId } from "../../hooks/useUniqueId";
import { useNow } from "../../hooks/useNow";
import { dayPalette, hourOf } from "../../utils/dayPhase";
import type { AuthStackScreenProps } from "../../navigation/types";

type Props = AuthStackScreenProps<"Welcome">;

/** Те же цвета, что у заставки: переход «заставка → приветствие» — одна и та же сцена, в которой появляются слова. */
const BG = "#052e2b";
const EMBER = "#ff8a3d";
const MINT = "#5eead4";

/**
 * Страница перед входом — одна мысль и одно действие. Знак и наклейки на изолиниях карты, заголовок с одной
 * ember-цифрой и две кнопки внизу, в зоне большого пальца: «Войти» (главная) и «Создать аккаунт». Никаких форм,
 * слайдов-онбординга и текста мелким шрифтом: человек понял, что это, за три секунды — и дальше действует.
 * Тёмная сцена в обеих темах (как у входа), поэтому цвета фиксированные; текст ≥ 7:1 на фоне.
 */
export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const uid = useUniqueId("welcome");
  // Основа сцены неизменна (совпадает с заставкой), а тёплое свечение в углу берёт цвет у времени суток: утром розовое, днём золотое,
  // на закате ember, ночью холодное — тот же «небесный» язык, что на экране входа.
  const glow = dayPalette(hourOf(useNow(60000))).glow;

  // Низкий (SE, 568) или узкий (320) экран: всё чуть мельче, чтобы кнопки остались на первом экране, а не уехали за край.
  const compact = height < 640;
  const narrow = width < 360;
  // Арт занимает до 36% высоты (в компактном — 26%): уменьшается, а не выдавливает кнопки.
  const art = Math.round(Math.min(width - 24, width >= 600 ? 460 : 340, compact ? Math.max(140, height * 0.26) : Math.max(190, height * (width >= 600 ? 0.4 : 0.36))));
  const title = t("welcome.titleLead");

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      <StatusBar style="light" />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 360 640" pointerEvents="none">
        <Defs>
          <RadialGradient id={`${uid}-mint`} cx="90" cy="150" r="340" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2dd4bf" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#2dd4bf" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${uid}-ember`} cx="300" cy="590" r="250" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={glow} stopOpacity={0.22} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="360" height="640" fill={`url(#${uid}-mint)`} />
        <Rect width="360" height="640" fill={`url(#${uid}-ember)`} />
      </Svg>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 12) + 16 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <StaggerReveal index={0}>
          <View style={styles.topRow}>
            <View style={styles.brand} accessibilityRole="header">
              <AppetiteMark size={28} />
              <Text style={[theme.fonts.bold, styles.wordmark]}>Appetite</Text>
            </View>
            <View style={styles.stamp}>
              <Text style={styles.stampText}>{narrow ? t("welcome.stampShort") : t("welcome.stamp")}</Text>
            </View>
          </View>
        </StaggerReveal>

        <View style={styles.artSlot}>
          <WelcomeArt size={art} />
        </View>

        <View style={[styles.bottom, compact && styles.bottomCompact]}>
          <StaggerReveal index={1}>
            <Text accessibilityRole="header" accessibilityLabel={`${title} 70%`} style={[theme.fonts.bold, styles.title, compact && styles.titleCompact]}>
              {title} <Text style={{ color: EMBER }}>70%</Text>
            </Text>
            <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{t("welcome.subtitle")}</Text>
          </StaggerReveal>

          <StaggerReveal index={2}>
            <View style={styles.actions}>
              {/* Две кнопки бьются по очереди (полпериода между ударами) — «сердцебиение», а не мигающая гирлянда;
                  главная сильнее и в бирюзе знака, вторая тише и белая. */}
              <Button title={t("welcome.signIn")} arrow pulse={{ color: MINT, spread: 12, strength: 0.55 }} onPress={() => navigation.navigate("Login")} />
              <Button
                title={t("welcome.createAccount")}
                variant="secondary"
                pulse={{ color: "#ffffff", spread: 8, strength: 0.34, delay: BUTTON_PULSE_PERIOD_MS / 2 }}
                onPress={() => navigation.navigate("Register")}
              />
            </View>
          </StaggerReveal>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 2 },
  wordmark: { fontSize: 19, color: "#ffffff", letterSpacing: -0.2 },
  stamp: { flexShrink: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(94,234,212,0.14)", borderWidth: 1, borderColor: "rgba(94,234,212,0.28)" },
  stampText: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.4, color: "#9ff3e6" },
  artSlot: { alignItems: "center", justifyContent: "center", flexShrink: 1, paddingVertical: 8 },
  // На планшете/десктопе блок с заголовком и кнопками не растягивается на весь экран.
  bottom: { gap: 22, width: "100%", maxWidth: 560, alignSelf: "center" },
  bottomCompact: { gap: 14 },
  title: { fontSize: 31, lineHeight: 38, letterSpacing: -0.6, color: "#ffffff" },
  titleCompact: { fontSize: 25, lineHeight: 31, letterSpacing: -0.4 },
  subtitleCompact: { marginTop: 8, fontSize: 14.5, lineHeight: 21 },
  subtitle: { marginTop: 12, fontSize: 16, lineHeight: 24, color: "rgba(255,255,255,0.8)", maxWidth: 420 },
  actions: { gap: 12 },
});
