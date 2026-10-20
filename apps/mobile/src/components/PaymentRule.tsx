import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { useTheme } from "../theme/ThemeProvider";
import { glassTokens } from "../theme/glass";
import { formatPickupDeadline } from "../utils/pickup";
import { GlassCard } from "./glass/GlassCard";

interface PaymentRuleProps {
  pickupStart: string;
  pickupEnd: string;
}

/**
 * Правило оплаты прямо над кнопкой «Оплатить»: решение необратимо (отмена только через поддержку), и узнать об этом
 * человек должен в момент нажатия, а не на предыдущем экране. Тон ember — «внимание», но без красного: красный в приложении
 * зарезервирован за оставшимся временем.
 */
export function PaymentRule({ pickupStart, pickupEnd }: PaymentRuleProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const accent = glassTokens(theme.mode, "ember").accent;
  const locale = i18n.language === "en" ? "en-GB" : "ru-RU";
  const deadline = formatPickupDeadline(pickupStart, pickupEnd, { tomorrow: t("offerDetail.tomorrow"), locale });

  return (
    <GlassCard tone="ember" glow={false} style={styles.card}>
      <View style={styles.row}>
        <TriangleAlert size={18} color={accent} strokeWidth={2.3} style={styles.icon} />
        <View style={styles.text}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t("checkout.ruleTitle")}</Text>
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>{t("checkout.ruleBody", { deadline })}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { marginTop: 1 },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  body: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
