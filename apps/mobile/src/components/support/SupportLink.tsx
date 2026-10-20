import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import LifeBuoy from "lucide-react-native/icons/life-buoy";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens } from "../../theme/glass";
import type { SupportOrderInfo } from "../../utils/support";
import { GlassCard } from "../glass/GlassCard";
import { SupportSheet } from "./SupportSheet";

/** Строка-вход «Нужна помощь»: на экране заказа — про этот заказ, в профиле — общая. Лист открывается поверх, экран не покидаем. */
export function SupportLink({ order }: { order?: SupportOrderInfo }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const accent = glassTokens(theme.mode, "plain").accent;
  const [open, setOpen] = useState(false);
  const title = order ? t("support.linkOrder") : t("support.linkProfile");
  const hint = order ? t("support.linkOrderHint") : t("support.linkProfileHint");

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, cursor: "pointer" }) as object}>
        <GlassCard tone="plain" glow={false} style={styles.card}>
          <View style={styles.row}>
            <LifeBuoy size={22} color={theme.colors.primary} strokeWidth={2.1} />
            <View style={styles.text}>
              <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
              <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{hint}</Text>
            </View>
            <ChevronRight size={18} color={accent} strokeWidth={2.3} />
          </View>
        </GlassCard>
      </Pressable>
      <SupportSheet visible={open} onClose={() => setOpen(false)} order={order} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 1 },
});
