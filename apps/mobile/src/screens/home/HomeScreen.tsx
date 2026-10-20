import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { OfferCategory, isBreakfastOffer } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { useLocation } from "../../hooks/useLocation";
import { useLocationLabel } from "../../hooks/useLocationLabel";
import { useNow } from "../../hooks/useNow";
import { useBreakfastTime } from "../../hooks/useBreakfastTime";
import { useNearbyOffers, DEFAULT_RADIUS_KM } from "../../hooks/useNearbyOffers";
import { Screen } from "../../components/Screen";
import { HomeHeader } from "../../components/HomeHeader";
import { HomeMapPreview } from "../../components/HomeMapPreview";
import { OfferRibbon } from "../../components/home/OfferRibbon";
import { ribbonOffers } from "../../utils/ribbon";
import { GlassSegmented } from "../../components/kit/GlassSegmented";
import { CategoryFilterBar } from "../../components/CategoryFilterBar";
import { OfferList } from "../../components/OfferList";
import { OfferListSkeleton } from "../../components/OfferListSkeleton";
import { LocationPermissionBanner } from "../../components/LocationPermissionBanner";
import { NotificationsBellButton } from "../../components/NotificationsBellButton";
import { EmptyView, ErrorView } from "../../components/StateViews";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Home">;
type Tab = "breakfast" | "now" | "evening";

const CATEGORY_VALUES: OfferCategory[] = [
  OfferCategory.FOOD,
  OfferCategory.BAKERY,
  OfferCategory.FLOWERS,
  OfferCategory.GROCERIES,
];

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const { location, loading: locationLoading, status: locationStatus, requestPermission, openSettings } =
    useLocation();
  const locationLabel = useLocationLabel(location, t("home.locationFallback"));
  const [tab, setTab] = useState<Tab>("now");
  const [category, setCategory] = useState<OfferCategory | undefined>(undefined);

  const { offers, error, refreshing, refresh } = useNearbyOffers(location, {
    category,
    radiusKm: DEFAULT_RADIUS_KM,
  });

  // "Сейчас" — окно самовывоза уже открыто; "Вечерние" — начнётся позже сегодня.
  const { nowOffers, eveningOffers } = useMemo(() => {
    const now = Date.now();
    const source = offers ?? [];
    return {
      nowOffers: source.filter((offer) => new Date(offer.pickupStart).getTime() <= now),
      eveningOffers: source.filter((offer) => new Date(offer.pickupStart).getTime() > now),
    };
  }, [offers]);

  // «Завтрак» — предложения, самовывоз которых закрывается сегодня не позже 10:00. Вкладка живёт только до 10:00 по времени
  // пилотного города (BREAKFAST_RULES) и исчезает ровно в 10:00, даже если приложение открыто; выбранная в этот момент — возвращает на «Сейчас».
  const clock = useNow(30_000);
  const breakfastTime = useBreakfastTime();
  const breakfastOffers = useMemo(() => (offers ?? []).filter((offer) => isBreakfastOffer(offer, clock)), [offers, clock]);
  const activeTab: Tab = tab === "breakfast" && !breakfastTime ? "now" : tab;
  useEffect(() => {
    if (tab === "breakfast" && !breakfastTime) setTab("now");
  }, [tab, breakfastTime]);

  const visibleOffers = activeTab === "breakfast" ? breakfastOffers : activeTab === "now" ? nowOffers : eveningOffers;

  // Лента над картой: что можно забрать прямо сейчас; ближайшие первыми, если позиция человека известна, иначе горящие.
  const focused = useIsFocused();
  const located = !!location && !location.isFallback && locationStatus === "granted";
  const ribbon = useMemo(() => ribbonOffers(offers ?? [], Date.now(), located), [offers, located]);

  const categoryOptions = [
    { value: undefined, label: t("home.allCategories") },
    ...CATEGORY_VALUES.map((value) => ({ value, label: t(`home.categories.${value}`) })),
  ];

  const isInitialLoading = locationLoading || (offers === null && !error);

  return (
    // Весь экран — один скролл: шапка, баннер, карта и фильтры уезжают вверх вместе
    // со списком. Раньше список скроллился внутри остатка высоты под ними, и когда
    // сверху ещё и баннер геопозиции, на этот остаток приходились считанные пиксели.
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.headerBlock}>
        <HomeHeader
          locationLabel={locationLabel}
          onPressProfile={() => navigation.navigate("Main", { screen: "Profile" })}
          onPressOrders={() => navigation.navigate("Main", { screen: "Orders" })}
        />
        <View style={styles.greetingRow}>
          <Text style={[theme.typography.h1, { color: theme.colors.text }]}>
            {user?.name ? t("home.greeting", { name: user.name.split(" ")[0] }) : t("home.greetingFallback")}
          </Text>
          <NotificationsBellButton />
        </View>
      </View>

      <LocationPermissionBanner status={locationStatus} onRequest={requestPermission} onOpenSettings={openSettings} />

      {!isInitialLoading && ribbon.length > 0 ? (
        <OfferRibbon
          offers={ribbon}
          active={focused}
          bleed={theme.spacing.md}
          onPressOffer={(offer) => navigation.navigate("OfferDetail", { offerId: offer.id })}
        />
      ) : null}

      {isInitialLoading || !location ? null : (
        <HomeMapPreview
          center={location}
          offers={offers ?? []}
          onSelectOffer={(offerId) => navigation.navigate("OfferDetail", { offerId })}
          onOpenFullMap={() => navigation.navigate("Main", { screen: "Map" })}
        />
      )}

      <View style={{ marginBottom: theme.spacing.sm }}>
        <GlassSegmented
          accessibilityLabel={t("home.timeGroup")}
          value={activeTab}
          onChange={setTab}
          options={[
            ...(breakfastTime ? [{ value: "breakfast" as const, label: t("home.breakfast") }] : []),
            { value: "now" as const, label: t("home.now") },
            { value: "evening" as const, label: t("home.evening") },
          ]}
        />
      </View>

      <View style={{ marginBottom: theme.spacing.sm }}>
        <CategoryFilterBar categories={categoryOptions} value={category} onChange={setCategory} />
      </View>

      <Text style={[theme.typography.h2, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
        {t("home.hotDiscounts")}
      </Text>

      {error ? (
        <ErrorView label={error} onRetry={refresh} />
      ) : isInitialLoading ? (
        <OfferListSkeleton />
      ) : visibleOffers.length === 0 ? (
        <EmptyView label={activeTab === "breakfast" ? t("home.emptyBreakfast") : activeTab === "now" ? t("home.emptyNow") : t("home.emptyEvening")} />
      ) : (
        <OfferList
          offers={visibleOffers}
          onPressOffer={(offer) => navigation.navigate("OfferDetail", { offerId: offer.id })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: { marginBottom: 8 },
  greetingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
