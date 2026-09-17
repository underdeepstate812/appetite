import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { OfferCategory } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useAuthStore } from "../../store/authStore";
import { useLocation } from "../../hooks/useLocation";
import { useLocationLabel } from "../../hooks/useLocationLabel";
import { useNearbyOffers, DEFAULT_RADIUS_KM } from "../../hooks/useNearbyOffers";
import { Screen } from "../../components/Screen";
import { HomeHeader } from "../../components/HomeHeader";
import { HomeMapPreview } from "../../components/HomeMapPreview";
import { SegmentedControl } from "../../components/SegmentedControl";
import { CategoryFilterBar } from "../../components/CategoryFilterBar";
import { BentoOfferGrid } from "../../components/BentoOfferGrid";
import { BentoOfferGridSkeleton } from "../../components/BentoOfferGridSkeleton";
import { LocationPermissionBanner } from "../../components/LocationPermissionBanner";
import { NotificationsBellButton } from "../../components/NotificationsBellButton";
import { EmptyView, ErrorView } from "../../components/StateViews";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Home">;
type Tab = "now" | "evening";

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

  const visibleOffers = tab === "now" ? nowOffers : eveningOffers;

  const categoryOptions = [
    { value: undefined, label: t("home.allCategories") },
    ...CATEGORY_VALUES.map((value) => ({ value, label: t(`home.categories.${value}`) })),
  ];

  const isInitialLoading = locationLoading || (offers === null && !error);

  return (
    <Screen>
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

      {isInitialLoading || !location ? null : (
        <HomeMapPreview
          center={location}
          offers={offers ?? []}
          onSelectOffer={(offerId) => navigation.navigate("OfferDetail", { offerId })}
          onOpenFullMap={() => navigation.navigate("Main", { screen: "Map" })}
        />
      )}

      <View style={{ marginBottom: theme.spacing.sm }}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "now", label: t("home.now") },
            { value: "evening", label: t("home.evening") },
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
        <ErrorView label={error} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerStyle={visibleOffers.length === 0 && !isInitialLoading ? styles.grow : undefined}
          showsVerticalScrollIndicator={false}
        >
          {isInitialLoading ? (
            <BentoOfferGridSkeleton />
          ) : visibleOffers.length === 0 ? (
            <EmptyView label={tab === "now" ? t("home.emptyNow") : t("home.emptyEvening")} />
          ) : (
            <BentoOfferGrid
              offers={visibleOffers}
              onPressOffer={(offer) => navigation.navigate("OfferDetail", { offerId: offer.id })}
            />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  headerBlock: { marginBottom: 8 },
  greetingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
