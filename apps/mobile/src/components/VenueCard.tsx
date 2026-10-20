import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Clock from "lucide-react-native/icons/clock";
import MapPin from "lucide-react-native/icons/map-pin";
import type { Business } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { glassTokens } from "../theme/glass";
import { formatPickupWindow } from "../utils/pickup";
import { routeUrl } from "../utils/route";
import type { BusinessState } from "../hooks/useBusiness";
import { Button } from "./Button";
import { GlassCard } from "./glass/GlassCard";

interface VenueCardProps {
  state: BusinessState;
  onRetry: () => void;
  /** Окно самовывоза — показываем рядом с адресом: «где» и «когда» читаются вместе. */
  pickupStart?: string;
  pickupEnd?: string;
  /** Кнопка «Маршрут» нужна на билете, но не в сводке перед оплатой. */
  withRoute?: boolean;
}

/** Открывает маршрут в приложении карт; если подходящего приложения нет (Android без geo:-обработчика) — в браузере. */
export function openRoute(venue: Pick<Business, "lat" | "lng" | "name">) {
  Linking.openURL(routeUrl(venue.lat, venue.lng, venue.name)).catch(() =>
    Linking.openURL(routeUrl(venue.lat, venue.lng, venue.name, "web")).catch(() => {})
  );
}

/**
 * «Где забрать»: заведение, адрес, окно выдачи и маршрут. Нужен на билете и в заказе — именно здесь человек
 * стоит на улице и ищет, куда идти, а раньше экран называл только сумму и код.
 */
export function VenueCard({ state, onRetry, pickupStart, pickupEnd, withRoute = true }: VenueCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const accent = glassTokens(theme.mode, "mint").accent;
  const locale = i18n.language === "en" ? "en-GB" : "ru-RU";
  const venue = state.status === "ready" ? state.business : null;
  const window = pickupStart && pickupEnd ? formatPickupWindow(pickupStart, pickupEnd, { tomorrow: t("offerDetail.tomorrow"), locale }) : null;

  return (
    <GlassCard tone="mint" style={styles.card}>
      <View style={styles.head}>
        <MapPin size={15} color={accent} strokeWidth={2.4} />
        <Text accessibilityRole="header" style={[styles.title, { color: accent }]}>
          {t("venue.title")}
        </Text>
      </View>

      {venue ? (
        <>
          <Text style={[theme.fonts.bold, styles.name, { color: theme.colors.text }]} numberOfLines={2}>
            {venue.name}
          </Text>
          <Text style={[styles.address, { color: theme.colors.textMuted }]}>{venue.address}</Text>
        </>
      ) : state.status === "loading" ? (
        <Text style={[styles.address, { color: theme.colors.textMuted }]}>{t("common.loading")}</Text>
      ) : (
        <Text style={[styles.address, { color: theme.colors.textMuted }]}>{t("venue.unavailable")}</Text>
      )}

      {window ? (
        <View style={styles.when}>
          <Clock size={15} color={theme.colors.textMuted} strokeWidth={2.2} />
          <Text style={[styles.whenText, { color: theme.colors.text }]}>{t("venue.when", { range: window })}</Text>
        </View>
      ) : null}

      {/* Маршрут нужен там, куда ещё идти; повтор — всегда, когда адрес не загрузился (в том числе в истории). */}
      {venue && withRoute ? (
        <View style={styles.action}>
          <Button
            title={t("offerDetail.route")}
            variant="secondary"
            arrow
            accessibilityLabel={t("venue.routeLabel", { name: venue.name })}
            onPress={() => openRoute(venue)}
          />
        </View>
      ) : state.status === "failed" ? (
        <View style={styles.action}>
          <Button title={t("common.retry")} variant="secondary" size="sm" onPress={onRetry} />
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  name: { fontSize: 17, lineHeight: 22 },
  address: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  when: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  whenText: { fontSize: 14, fontWeight: "600" },
  // На всю ширину карточки: у человека на улице это главное действие, и попасть по нему должно быть легко.
  action: { marginTop: 14 },
});
