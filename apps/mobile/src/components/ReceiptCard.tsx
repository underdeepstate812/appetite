import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import BadgeCheck from "lucide-react-native/icons/badge-check";
import HandHelping from "lucide-react-native/icons/hand-helping";
import { ReceiptDisputeReason, type Order } from "@apetite/shared";
import { ordersApi } from "../api/orders";
import { ApiError } from "../api/client";
import { useTheme } from "../theme/ThemeProvider";
import { glassTokens } from "../theme/glass";
import { playHaptic } from "../utils/haptics";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { GlassCard } from "./glass/GlassCard";
import { RadioCards } from "./kit/RadioCards";

const REASONS: ReceiptDisputeReason[] = [ReceiptDisputeReason.NOT_RECEIVED, ReceiptDisputeReason.WRONG_ITEM, ReceiptDisputeReason.QUALITY, ReceiptDisputeReason.OTHER];

interface ReceiptCardProps {
  order: Order;
  /** Сервер принял ответ — экран подставляет обновлённый заказ. */
  onUpdated: (order: Order) => void;
}

/**
 * Подтверждение получения со стороны покупателя. Заведение отметило выдачу кодом — теперь отвечает и покупатель:
 * «получил» либо спор. Так выдачу нельзя «закрыть» за его спиной, а у платформы есть основания помочь, если заказ не передан.
 * Показывается только у выданных заказов; после ответа превращается в спокойную строку-итог.
 */
export function ReceiptCard({ order, onUpdated }: ReceiptCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const accent = glassTokens(theme.mode, "mint").accent;
  const warn = glassTokens(theme.mode, "ember").accent;
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState<ReceiptDisputeReason>(ReceiptDisputeReason.NOT_RECEIVED);
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (order.status !== "COMPLETED") return null;

  const submit = async (received: boolean) => {
    setBusy(received ? "yes" : "no");
    setError(null);
    try {
      const updated = await ordersApi.confirmReceipt(order.id, received ? { received: true } : { received: false, reason });
      playHaptic(received ? "success" : "tap");
      setSheet(false);
      onUpdated(updated);
    } catch (submitError) {
      setError(submitError instanceof ApiError && submitError.statusCode !== 0 ? submitError.message : t("receipt.error"));
    } finally {
      setBusy(null);
    }
  };

  if (order.receiptConfirmedAt) {
    return (
      <GlassCard tone="mint" glow={false} style={styles.card}>
        <View style={styles.row}>
          <BadgeCheck size={22} color={accent} strokeWidth={2.2} />
          <View style={styles.text}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t("receipt.confirmedTitle")}</Text>
            <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{t("receipt.confirmedHint")}</Text>
          </View>
        </View>
      </GlassCard>
    );
  }

  if (order.receiptDisputedAt) {
    return (
      <GlassCard tone="ember" glow={false} style={styles.card}>
        <View style={styles.row}>
          <HandHelping size={22} color={warn} strokeWidth={2.2} />
          <View style={styles.text}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t("receipt.disputedTitle")}</Text>
            <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{t("receipt.disputedHint")}</Text>
          </View>
        </View>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard tone="mint" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
          {t("receipt.title")}
        </Text>
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{t("receipt.hint")}</Text>
        {error && !sheet ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
            {error}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button title={t("receipt.yes")} onPress={() => void submit(true)} loading={busy === "yes"} disabled={busy !== null} />
          <Button title={t("receipt.no")} variant="secondary" onPress={() => setSheet(true)} disabled={busy !== null} />
        </View>
      </GlassCard>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} closeLabel={t("support.close")}>
        <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.colors.text }]}>
          {t("receipt.sheetTitle")}
        </Text>
        <Text style={[styles.hint, { color: theme.colors.textMuted, marginBottom: 14 }]}>{t("receipt.sheetHint")}</Text>
        <RadioCards
          groupLabel={t("receipt.sheetTitle")}
          value={reason}
          onChange={setReason}
          options={REASONS.map((key) => ({ value: key, label: t(`receipt.reasons.${key}`) }))}
        />
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
            {error}
          </Text>
        ) : null}
        <View style={styles.sheetActions}>
          <Button title={busy === "no" ? t("receipt.sending") : t("receipt.send")} onPress={() => void submit(false)} loading={busy === "no"} disabled={busy !== null} arrow />
          <Button title={t("support.close")} variant="ghost" onPress={() => setSheet(false)} disabled={busy !== null} />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  text: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  hint: { fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  error: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  actions: { gap: 10, marginTop: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  sheetActions: { gap: 10, marginTop: 16 },
});
