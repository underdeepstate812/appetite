import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { useLocation } from "../../hooks/useLocation";
import { useNearbyOffers, DEFAULT_RADIUS_KM } from "../../hooks/useNearbyOffers";
import { Screen } from "../../components/Screen";
import { OfferCard } from "../../components/OfferCard";
import { LocationPermissionBanner } from "../../components/LocationPermissionBanner";
import { LeafletMapView } from "../../components/LeafletMapView";
import { LoadingView, EmptyView, ErrorView } from "../../components/StateViews";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Map">;

/**
 * react-native-maps не реализует web (его собственный MapView.web.ts — заглушка
 * react-native-web UnimplementedView) — здесь настоящая карта на Leaflet/OpenStreetMap
 * (бесплатно, без API-ключа), список под ней остаётся для быстрого сканирования по
 * расстоянию. Native-вариант — MapScreen.native.tsx (react-native-maps).
 */
export function MapScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { location, loading: locationLoading, status: locationStatus, requestPermission, openSettings } =
    useLocation();
  const { offers, error, refreshing, refresh } = useNearbyOffers(location, { radiusKm: DEFAULT_RADIUS_KM });

  if (locationLoading || (offers === null && !error)) {
    return (
      <Screen>
        <LoadingView label={t("common.loading")} />
      </Screen>
    );
  }

  const sorted = [...(offers ?? [])].sort((a, b) => a.distanceKm - b.distanceKm);

  return (
    <Screen>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.xs }]}>
        {t("map.title")}
      </Text>
      <LocationPermissionBanner status={locationStatus} onRequest={requestPermission} onOpenSettings={openSettings} />
      {location ? (
        <View style={{ marginBottom: theme.spacing.sm }}>
          <LeafletMapView
            center={{ lat: location.lat, lng: location.lng }}
            offers={sorted}
            onSelectOffer={(offerId) => navigation.navigate("OfferDetail", { offerId })}
          />
        </View>
      ) : null}
      {error ? (
        <ErrorView label={error} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerStyle={sorted.length === 0 ? styles.grow : undefined}
        >
          {sorted.length === 0 ? (
            <EmptyView label={t("home.emptyNow")} />
          ) : (
            sorted.map((offer) => (
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
});
