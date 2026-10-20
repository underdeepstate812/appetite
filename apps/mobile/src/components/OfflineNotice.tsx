import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import WifiOff from "lucide-react-native/icons/wifi-off";
import { useTheme } from "../theme/ThemeProvider";
import { glassTokens } from "../theme/glass";
import { Button } from "./Button";
import { GlassCard } from "./glass/GlassCard";

interface OfflineNoticeProps {
  /**
   * Что показано из сохранённого: билет (код можно предъявить), билет с истёкшим окном (код уже не годится)
   * или список (статусы могли устареть).
   */
  kind: "ticket" | "ticketExpired" | "list";
  savedAt: string | null;
  onRetry: () => void;
}

const TEXT_KEY = { ticket: "offline.ticket", ticketExpired: "offline.ticketExpired", list: "offline.list" } as const;

/** Плашка «нет сети»: спокойная, не красная, — человеку у кассы нужно знать только, что билет настоящий и его можно показывать. */
export function OfflineNotice({ kind, savedAt, onRetry }: OfflineNoticeProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const accent = glassTokens(theme.mode, "ember").accent;
  const time = savedAt ? new Date(savedAt).toLocaleTimeString(i18n.language === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <GlassCard tone="ember" glow={false} style={styles.card}>
      <View style={styles.row}>
        <WifiOff size={20} color={accent} strokeWidth={2.3} style={styles.icon} />
        {/* Роль alert — на тексте, а не на всей карточке: контейнер с кнопкой нельзя делать «элементом доступности», он проглотил бы кнопку. */}
        <View style={styles.text} accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={[styles.title, { color: theme.colors.text }]}>{t("offline.title")}</Text>
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>{t(TEXT_KEY[kind])}</Text>
        </View>
      </View>
      {/* Время и «Обновить» — отдельной строкой под текстом: рядом с текстом кнопка сжимала его в три строки. */}
      <View style={styles.footer}>
        {time ? <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{t("offline.savedAt", { time })}</Text> : <View />}
        <Button title={t("offline.retry")} variant="secondary" size="sm" onPress={onRetry} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 12 },
  row: { flexDirection: "row", gap: 12 },
  icon: { marginTop: 2 },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  body: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10 },
  meta: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
});
