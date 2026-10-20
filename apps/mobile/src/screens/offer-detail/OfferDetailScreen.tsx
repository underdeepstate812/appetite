import React, { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Clock from "lucide-react-native/icons/clock";
import CreditCard from "lucide-react-native/icons/credit-card";
import MapPin from "lucide-react-native/icons/map-pin";
import Package from "lucide-react-native/icons/package";
import QrCode from "lucide-react-native/icons/qr-code";
import ShieldAlert from "lucide-react-native/icons/shield-alert";
import ShoppingBag from "lucide-react-native/icons/shopping-bag";
import Store from "lucide-react-native/icons/store";
import { getOfferUrgencyRatio, type Business, type Offer } from "@apetite/shared";
import { offersApi } from "../../api/offers";
import { businessesApi } from "../../api/businesses";
import { useTheme } from "../../theme/ThemeProvider";
import { useNow } from "../../hooks/useNow";
import { Button } from "../../components/Button";
import { LoadingView, ErrorView } from "../../components/StateViews";
import { InfoCard } from "../../components/offer/InfoCard";
import { DiscountNote } from "../../components/offer/DiscountNote";
import { FoodInfoCard } from "../../components/offer/FoodInfoCard";
import { OfferHero } from "../../components/offer/OfferHero";
import { StockMeter } from "../../components/offer/StockMeter";
import { WindowMeter } from "../../components/offer/WindowMeter";
import { CATEGORY_ICON } from "../../components/offer/categoryIcon";
import { isHotOffer } from "../../utils/offers";
import { routeUrl } from "../../utils/route";
import { getTimeLeft } from "../../utils/time";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"OfferDetail">;
type BusinessState = { status: "loading" } | { status: "ready"; business: Business } | { status: "failed" };

/** Ширина колонки контента: на планшете и в вебе экран не растягивается на всю ширину. */
const COLUMN = 560;
const WIDE_BREAKPOINT = 600;

const rub = (minor: number) => `${Math.round(minor / 100).toLocaleString("ru-RU")} ₽`;

export function OfferDetailScreen({ route, navigation }: Props) {
  const { offerId } = route.params;
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const now = useNow(30000);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [business, setBusiness] = useState<BusinessState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const locale = i18n.language === "en" ? "en-GB" : "ru-RU";
  const wide = width >= WIDE_BREAKPOINT;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setBusiness({ status: "loading" });
    offersApi
      .get(offerId)
      .then((data) => {
        if (cancelled) return;
        setOffer(data);
        // Название и адрес заведения — важная, но не критичная часть: сбой этого запроса не должен ломать покупку.
        businessesApi
          .get(data.businessId)
          .then((found) => !cancelled && setBusiness({ status: "ready", business: found }))
          .catch(() => !cancelled && setBusiness({ status: "failed" }));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : t("offerDetail.notFound"));
      });
    return () => {
      cancelled = true;
    };
  }, [offerId, t, reloadKey]);

  if (error) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background, padding: theme.spacing.md }]}>
        <ErrorView label={error} onRetry={() => setReloadKey((key) => key + 1)} />
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background, padding: theme.spacing.md }]}>
        <LoadingView label={t("common.loading")} />
      </View>
    );
  }

  const hot = isHotOffer(offer, now);
  const ratio = getOfferUrgencyRatio(offer, now);
  const closed = getTimeLeft(offer.pickupEnd, now).isPast || offer.status !== "ACTIVE";
  const soldOut = offer.quantityLeft <= 0;
  const unavailable = closed || soldOut;
  const Icon = CATEGORY_ICON[offer.category];
  const venue = business.status === "ready" ? business.business : null;
  const saved = offer.originalPrice - offer.discountedPrice;
  const priceColor = hot ? theme.colors.ember : theme.colors.primary;
  const ctaTitle = soldOut ? t("offerDetail.soldOut") : closed ? t("offerDetail.closedCta") : t("offerDetail.buy");

  const openRoute = () => {
    if (!venue) return;
    Linking.openURL(routeUrl(venue.lat, venue.lng, venue.name)).catch(() => {});
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.column, wide && styles.columnWide]}>
          <OfferHero offer={offer} ratio={ratio} hot={hot} wide={wide} />

          <View style={styles.body}>
            <View style={styles.venueRow}>
              <View style={[styles.venueLogo, { backgroundColor: theme.colors.primarySoft }]}>
                <Store size={16} color={theme.colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={[styles.venueName, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {venue?.name ?? t("offerDetail.venueFallback")}
              </Text>
              <View style={[styles.chip, { backgroundColor: theme.colors.primarySoft }]}>
                <Icon size={13} color={theme.colors.primary} strokeWidth={2.2} />
                <Text style={[styles.chipText, { color: theme.colors.primary }]}>{t(`home.categories.${offer.category}`)}</Text>
              </View>
            </View>

            <Text accessibilityRole="header" style={[theme.typography.h1, styles.title, { color: theme.colors.text }]}>
              {offer.title}
            </Text>
            {offer.description ? <Text style={[styles.description, { color: theme.colors.textMuted }]}>{offer.description}</Text> : null}

            <View style={styles.priceRow}>
              <Text style={[theme.fonts.heavy, styles.price, { color: priceColor }]}>{rub(offer.discountedPrice)}</Text>
              <Text style={[styles.oldPrice, { color: theme.colors.textMuted }]}>{rub(offer.originalPrice)}</Text>
            </View>
            {saved > 0 ? (
              <View style={[styles.saveChip, { backgroundColor: theme.colors.successSoft }]}>
                <Text style={[styles.saveText, { color: theme.colors.success }]}>{t("offerDetail.save", { amount: Math.round(saved / 100).toLocaleString("ru-RU") })}</Text>
              </View>
            ) : null}

            {!unavailable ? <DiscountNote offer={offer} now={now} locale={locale} /> : null}

            <FoodInfoCard offer={offer} />

            <InfoCard icon={<Clock size={15} color={theme.colors.textMuted} strokeWidth={2.2} />} title={t("offerDetail.windowTitle")}>
              <WindowMeter offer={offer} locale={locale} />
            </InfoCard>

            <InfoCard icon={<Package size={15} color={theme.colors.textMuted} strokeWidth={2.2} />} title={t("offerDetail.stockTitle")}>
              <StockMeter left={offer.quantityLeft} total={offer.quantityTotal} />
            </InfoCard>

            <InfoCard icon={<MapPin size={15} color={theme.colors.textMuted} strokeWidth={2.2} />} title={t("offerDetail.whereTitle")}>
              {venue ? (
                <View style={styles.whereRow}>
                  <View style={styles.whereText}>
                    <Text style={[theme.fonts.bold, styles.whereName, { color: theme.colors.text }]} numberOfLines={2}>
                      {venue.name}
                    </Text>
                    <Text style={[styles.address, { color: theme.colors.textMuted }]}>{venue.address}</Text>
                  </View>
                  <Button title={t("offerDetail.route")} variant="secondary" size="sm" onPress={openRoute} />
                </View>
              ) : (
                <Text style={[styles.address, { color: theme.colors.textMuted }]}>
                  {business.status === "loading" ? t("common.loading") : t("offerDetail.retryBusiness")}
                </Text>
              )}
            </InfoCard>

            <Text accessibilityRole="header" style={[styles.howTitle, { color: theme.colors.textMuted }]}>
              {t("offerDetail.howTitle")}
            </Text>
            <View style={styles.steps}>
              {[
                { Glyph: CreditCard, label: t("offerDetail.step1") },
                { Glyph: QrCode, label: t("offerDetail.step2") },
                { Glyph: ShoppingBag, label: t("offerDetail.step3") },
              ].map(({ Glyph, label }, index) => (
                <View key={label} style={styles.step}>
                  <View style={[styles.stepIcon, { backgroundColor: theme.colors.primarySoft }]}>
                    <Glyph size={20} color={theme.colors.primary} strokeWidth={2} />
                    <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                      <Text style={[styles.stepNumberText, { color: theme.colors.onPrimary }]}>{index + 1}</Text>
                    </View>
                  </View>
                  <Text style={[styles.stepLabel, { color: theme.colors.text }]}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.rule, { backgroundColor: theme.colors.warningSoft }]}>
              <ShieldAlert size={16} color={theme.colors.warning} strokeWidth={2.2} />
              <Text style={[styles.ruleText, { color: theme.colors.warning }]}>{t("offerDetail.noCancel")}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Панель покупки закреплена внизу — в зоне большого пальца; цена всегда на виду, пока читаешь описание. */}
      <View style={[styles.bar, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <View style={[styles.barInner, wide && { maxWidth: COLUMN - 40 }]}>
          <View style={styles.barPrice}>
            <Text style={[theme.fonts.heavy, styles.barPriceValue, { color: unavailable ? theme.colors.textMuted : priceColor }]}>{rub(offer.discountedPrice)}</Text>
            <Text style={[styles.barPriceSub, { color: theme.colors.textMuted }]}>−{offer.discountPercent}%</Text>
          </View>
          <View style={styles.barButton}>
            <Button title={ctaTitle} onPress={() => navigation.navigate("Checkout", { offerId })} disabled={unavailable} arrow={!unavailable} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { alignItems: "center", paddingBottom: 28 },
  column: { width: "100%" },
  columnWide: { maxWidth: COLUMN, paddingHorizontal: 20 },
  body: { paddingHorizontal: 20, paddingTop: 18 },
  venueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  venueLogo: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  venueName: { flex: 1, fontSize: 14, fontWeight: "600" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 12.5, fontWeight: "700" },
  title: { marginTop: 10, fontSize: 24, lineHeight: 31 },
  description: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 12, marginTop: 16 },
  price: { fontSize: 36, lineHeight: 42, letterSpacing: -1 },
  oldPrice: { fontSize: 18, textDecorationLine: "line-through" },
  saveChip: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  saveText: { fontSize: 13, fontWeight: "700" },
  whereRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  whereText: { flex: 1 },
  whereName: { fontSize: 15, lineHeight: 21 },
  address: { marginTop: 2, fontSize: 14, lineHeight: 20 },
  howTitle: { marginTop: 24, marginBottom: 12, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  steps: { flexDirection: "row", gap: 10 },
  step: { flex: 1, alignItems: "center", gap: 8 },
  stepIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stepNumber: { position: "absolute", top: -5, right: -5, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontSize: 11, fontWeight: "800" },
  stepLabel: { fontSize: 12.5, lineHeight: 17, textAlign: "center", fontWeight: "500" },
  rule: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14 },
  ruleText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: "600" },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingHorizontal: 20, alignItems: "center" },
  barInner: { width: "100%", flexDirection: "row", alignItems: "center", gap: 16 },
  barPrice: { minWidth: 92 },
  barPriceValue: { fontSize: 22, lineHeight: 27, letterSpacing: -0.5 },
  barPriceSub: { fontSize: 12.5, fontWeight: "700" },
  barButton: { flex: 1 },
});
