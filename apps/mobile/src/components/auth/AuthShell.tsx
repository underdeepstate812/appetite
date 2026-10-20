import React, { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import { AppetiteMark } from "../icons/AppetiteMark";
import { BackButton } from "../BackButton";
import { DayHeroArt } from "./DayHeroArt";
import { OfferPoster, type PosterScene } from "./OfferPoster";

interface AuthShellProps {
  /** Короткое обещание: показывается в сжатом герое (регистрация, маленькие экраны), где постера нет. */
  tagline: string;
  /** Сжатый герой (без постера оффера) — для длинных форм вроде регистрации. */
  compact?: boolean;
  /** Шаг назад к приветственной странице; нет — значит экран открыт напрямую (ссылка) и возвращаться некуда. */
  onBack?: () => void;
  children: React.ReactNode;
}

/** Ниже этой высоты (маленький телефон или открытая клавиатура) герой сжимается: форме нужнее место. */
const COMPACT_HEIGHT = 720;

/**
 * Каркас экранов входа и регистрации: тёмный герой с «небом» по времени суток и постером живого оффера, поверх
 * которого поднимается форма-шторка. Форма сидит в нижней половине экрана — в зоне большого пальца, а
 * клавиатура просто сдвигает экран (KeyboardAvoidingView + прокрутка с «тап по кнопке не теряется»).
 */
export function AuthShell({ tagline, compact: forceCompact = false, onBack, children }: AuthShellProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = forceCompact || height < COMPACT_HEIGHT;
  // Небо героя зависит от времени суток, а гало диска — от жара показанного предложения (его сообщает постер).
  const [scene, setScene] = useState<PosterScene>({ heat: null });
  const handleScene = useCallback((next: PosterScene) => setScene((current) => (current.heat === next.heat ? current : next)), []);

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: "#052e2b" }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.grow}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.hero, { paddingTop: insets.top + (compact ? 14 : 24), paddingBottom: compact ? 44 : 56 }]}>
          <DayHeroArt heat={compact ? null : scene.heat} />
          <View style={styles.topRow}>
            <View style={styles.brandRow} accessibilityRole="header">
              <AppetiteMark size={compact ? 30 : 34} />
              <Text style={[theme.fonts.bold, styles.wordmark]}>Appetite</Text>
            </View>
            {onBack ? <BackButton onPress={onBack} onDark /> : null}
          </View>
          {compact ? <Text style={[theme.fonts.bold, styles.tagline]}>{tagline}</Text> : <OfferPoster onSceneChange={handleScene} />}
        </View>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              paddingBottom: Math.max(insets.bottom, 12) + 20,
            },
          ]}
        >
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  hero: { paddingHorizontal: 24, overflow: "hidden" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18, marginRight: -10 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  wordmark: { fontSize: 20, color: "#ffffff", letterSpacing: -0.2 },
  // Ширина ограничена: заголовок переносится раньше, чем дойдёт до «солнца» на картинке.
  tagline: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: "#ffffff", maxWidth: "62%" },
  sheet: { flexGrow: 1, marginTop: -28, paddingHorizontal: 24, paddingTop: 28, boxShadow: "0 -12px 32px rgba(0,0,0,0.22)" },
});
