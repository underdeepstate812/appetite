import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Maximize2 } from "lucide-react-native";
import type { NearbyOffer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { PulsingMapPin } from "./PulsingMapPin";
import { MapPreviewChips } from "./MapPreviewChips";

const PREVIEW_HEIGHT = 220;

/** ⚠️ Не проверено вживую — в окружении разработки нет iOS/Android-симулятора (см. apps/mobile/README.md). */
export function HomeMapPreview({
  center,
  offers,
  onSelectOffer,
  onOpenFullMap,
}: {
  center: { lat: number; lng: number };
  offers: NearbyOffer[];
  onSelectOffer: (offerId: string) => void;
  onOpenFullMap: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={[styles.wrap, { borderRadius: theme.radii.lg }]}>
      <MapView
        style={{ height: PREVIEW_HEIGHT }}
        provider={PROVIDER_DEFAULT}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {offers.map((offer) => (
          <Marker
            key={offer.id}
            coordinate={{ latitude: offer.businessLat, longitude: offer.businessLng }}
            onPress={() => onSelectOffer(offer.id)}
          >
            <PulsingMapPin discountPercent={offer.discountPercent} />
          </Marker>
        ))}
      </MapView>
      <MapPreviewChips offers={offers} />
      <Pressable
        onPress={onOpenFullMap}
        style={[styles.openMapBtn, { backgroundColor: theme.colors.surfaceElevated }]}
      >
        <Maximize2 size={13} color={theme.colors.text} strokeWidth={2.2} />
        <Text style={[styles.openMapText, { color: theme.colors.text }]}>{t("home.openMap")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", marginBottom: 20, position: "relative" },
  openMapBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  openMapText: { fontSize: 12, fontWeight: "700" },
});
