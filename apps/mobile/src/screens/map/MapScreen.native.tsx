import React from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { useLocation } from "../../hooks/useLocation";
import { useNearbyOffers, DEFAULT_RADIUS_KM } from "../../hooks/useNearbyOffers";
import { Screen } from "../../components/Screen";
import { LocationPermissionBanner } from "../../components/LocationPermissionBanner";
import { LoadingView, ErrorView } from "../../components/StateViews";
import { PulsingMapPin } from "../../components/PulsingMapPin";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Map">;

/** ⚠️ Не проверено вживую — в окружении разработки нет iOS/Android-симулятора. */
export function MapScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { location, loading: locationLoading, status: locationStatus, requestPermission, openSettings } =
    useLocation();
  const { offers, error } = useNearbyOffers(location, { radiusKm: DEFAULT_RADIUS_KM });

  if (locationLoading || !location || (offers === null && !error)) {
    return (
      <Screen>
        <LoadingView label={t("common.loading")} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorView label={error} />
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={!location.isFallback}
      >
        {(offers ?? []).map((offer) => (
          <Marker
            key={offer.id}
            coordinate={{ latitude: offer.businessLat, longitude: offer.businessLng }}
            title={offer.title}
            description={`${offer.businessName} · -${offer.discountPercent}%`}
            onPress={() => navigation.navigate("OfferDetail", { offerId: offer.id })}
          >
            <PulsingMapPin discountPercent={offer.discountPercent} />
          </Marker>
        ))}
      </MapView>
      {locationStatus !== "granted" ? (
        <View style={styles.overlay}>
          <LocationPermissionBanner status={locationStatus} onRequest={requestPermission} onOpenSettings={openSettings} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  overlay: { position: "absolute", top: 12, left: 12, right: 12 },
});
