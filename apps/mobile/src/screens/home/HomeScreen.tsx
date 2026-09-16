import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { OfferCategory } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useLocation } from "../../hooks/useLocation";
import { useNearbyOffers, DEFAULT_RADIUS_KM } from "../../hooks/useNearbyOffers";
import { Screen } from "../../components/Screen";
import { SegmentedControl } from "../../components/SegmentedControl";
import { CategoryFilterBar } from "../../components/CategoryFilterBar";
import { OfferCard } from "../../components/OfferCard";
import { LocationPermissionBanner } from "../../components/LocationPermissionBanner";
import { NotificationsBellButton } from "../../components/NotificationsBellButton";
import { LoadingView, EmptyView, ErrorView } from "../../components/StateViews";
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
  const { location, loading: locationLoading, status: locationStatus, requestPermission, openSettings } =
    useLocation();
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

  if (locationLoading || (offers === null && !error)) {
    return (
      <Screen>
        <LoadingView label={t("common.loading")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[theme.typography.h1, { color: theme.colors.text }]}>{t("home.title")}</Text>
        <NotificationsBellButton />
      </View>

      <LocationPermissionBanner status={locationStatus} onRequest={requestPermission} onOpenSettings={openSettings} />

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

      {error ? (
        <ErrorView label={error} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerStyle={visibleOffers.length === 0 ? styles.grow : undefined}
        >
          {visibleOffers.length === 0 ? (
            <EmptyView label={tab === "now" ? t("home.emptyNow") : t("home.emptyEvening")} />
          ) : (
            visibleOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onPress={() => navigation.navigate("OfferDetail", { offerId: offer.id })}
              />
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
});
