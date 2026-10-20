import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import LifeBuoy from "lucide-react-native/icons/life-buoy";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens } from "../../theme/glass";
import {
  buildMailto,
  GENERAL_REASONS,
  ORDER_REASONS,
  shortOrderNumber,
  SUPPORT_EMAIL,
  type SupportOrderInfo,
  type SupportReason,
} from "../../utils/support";
import { openMailLink } from "../../utils/links";
import { BottomSheet } from "../BottomSheet";
import { Button } from "../Button";
import { RadioCards } from "../kit/RadioCards";

interface SupportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** С заказом — письмо уходит с его номером и данными; без — общее обращение (из профиля). */
  order?: SupportOrderInfo;
}

/**
 * «Нужна помощь?»: тема обращения + письмо, в которое уже подставлены номер заказа, предложение, заведение, сумма и дата.
 * Код самовывоза в письмо НЕ попадает: это секрет, по которому заведение выдаёт заказ, поддержке он не нужен.
 */
export function SupportSheet({ visible, onClose, order }: SupportSheetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const accent = glassTokens(theme.mode, "mint").accent;
  const reasons = order ? ORDER_REASONS : GENERAL_REASONS;
  const [reason, setReason] = useState<SupportReason>(reasons[0]);
  const [mailFailed, setMailFailed] = useState(false);

  // Лист живёт в строке-входе и переиспользуется: при каждом открытии начинаем с чистого состояния.
  useEffect(() => {
    if (visible) {
      setReason(reasons[0]);
      setMailFailed(false);
    }
  }, [visible, reasons]);

  const compose = () => {
    const locale = i18n.language === "en" ? "en-GB" : "ru-RU";
    const number = order ? shortOrderNumber(order.id) : "";
    const lines = [
      t("support.bodyHello"),
      "",
      t("support.bodyTopic", { reason: t(`support.reasons.${reason}`) }),
      order ? t("support.bodyOrder", { number, id: order.id }) : null,
      order?.title ? t("support.bodyOffer", { title: order.title }) : null,
      order?.venue ? t("support.bodyVenue", { venue: order.venue }) : null,
      order ? t("support.bodyAmount", { amount: Math.round(order.totalPrice / 100) }) : null,
      order
        ? t("support.bodyDate", {
            date: new Date(order.createdAt).toLocaleString(locale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
          })
        : null,
      "",
      t("support.bodyAsk"),
      "",
    ].filter((line): line is string => line !== null);
    const subject = order ? t("support.subject", { number }) : t("support.subjectGeneral");
    return buildMailto(SUPPORT_EMAIL, subject, lines.join("\n"));
  };

  const send = () => {
    setMailFailed(false);
    openMailLink(compose()).catch(() => setMailFailed(true));
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} closeLabel={t("support.close")} swipeToDismiss>
      <View style={styles.head}>
        <View style={[styles.halo, { backgroundColor: theme.colors.primarySoft, boxShadow: `0 0 24px ${accent}55` }]}>
          <LifeBuoy size={24} color={accent} strokeWidth={2.2} />
        </View>
        <View style={styles.headText}>
          <Text accessibilityRole="header" style={[theme.typography.h2, { color: theme.colors.text }]}>
            {t("support.title")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]} numberOfLines={2}>
            {order ? [t("support.orderLine", { number: shortOrderNumber(order.id) }), order.title].filter(Boolean).join(" · ") : t("support.subtitleGeneral")}
          </Text>
        </View>
      </View>

      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{t("support.reasonLabel")}</Text>
      <RadioCards
        groupLabel={t("support.reasonLabel")}
        value={reason}
        onChange={setReason}
        options={reasons.map((key) => ({ value: key, label: t(`support.reasons.${key}`) }))}
      />

      {order ? <Text style={[styles.note, { color: theme.colors.textMuted }]}>{t("support.cancelNote")}</Text> : null}

      <View style={styles.actions}>
        <Button title={t("support.send")} onPress={send} arrow />
        <Text selectable style={[styles.email, { color: theme.colors.textMuted }]}>
          {SUPPORT_EMAIL}
        </Text>
        {mailFailed ? (
          <Text accessibilityRole="alert" style={[styles.fail, { color: theme.colors.danger }]}>
            {t("support.noMail", { email: SUPPORT_EMAIL })}
          </Text>
        ) : null}
        <Button title={t("support.close")} variant="ghost" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  halo: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },
  note: { fontSize: 13, lineHeight: 18, marginTop: 14 },
  actions: { marginTop: 18, gap: 10 },
  email: { fontSize: 13, textAlign: "center" },
  fail: { fontSize: 13, lineHeight: 18, textAlign: "center" },
});
