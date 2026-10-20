import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useTheme } from "../../theme/ThemeProvider";
import { PulsingMapPin } from "../PulsingMapPin";
import { centerLatForInset } from "../../utils/mapRail";
import type { MapSurfaceProps } from "../../screens/map/MapExperience";

/** Высота видимой области при перелёте к пину (~1,3 км по вертикали: район, где пин и соседи различимы). */
const FLY_LATITUDE_DELTA = 0.012;

/**
 * Платформенная карта для iOS/Android (react-native-maps): те же пины и та же логика выбора, что у web-карты.
 * ⚠️ Не проверено вживую — в окружении разработки нет iOS/Android-симулятора: покрыто типами, jest и `expo export`.
 * Чтобы пин выбранного предложения не оказывался под лентой карточек, центр считаем сами (centerLatForInset), а не
 * через mapPadding: его поведение у Apple Maps и Google Maps разное.
 */
export function NativeMapSurface({ center, userPosition, offers, selectedId, followSelection, onSelectOffer, topInset, bottomInset, fitPoints, fitKey, recenterKey }: MapSurfaceProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(0);
  const lastFitKey = useRef<string | null>(null);
  const lastFlownId = useRef<string | null>(null);
  const lastRecenter = useRef(recenterKey);

  // Первый вид (и новый набор данных): охватываем первые карточки, а не весь город.
  useEffect(() => {
    if (!ready || fitPoints.length === 0 || lastFitKey.current === fitKey) return;
    lastFitKey.current = fitKey;
    const coordinates = fitPoints.map((point) => ({ latitude: point.lat, longitude: point.lng }));
    if (userPosition) coordinates.push({ latitude: userPosition.lat, longitude: userPosition.lng });
    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: topInset + 70, right: 40, bottom: bottomInset + 30, left: 40 },
      animated: false,
    });
  }, [ready, fitKey, fitPoints, userPosition, topInset, bottomInset]);

  // Выбор (после первого выбора человеком): карта плавно летит к пину, ставя его в середину полосы между шапкой и лентой.
  useEffect(() => {
    if (!ready || !selectedId || !followSelection || lastFlownId.current === selectedId) return;
    const offer = offers.find((item) => item.id === selectedId);
    if (!offer) return;
    lastFlownId.current = selectedId;
    mapRef.current?.animateToRegion(
      {
        latitude: centerLatForInset(offer.businessLat, FLY_LATITUDE_DELTA, height, bottomInset - topInset),
        longitude: offer.businessLng,
        latitudeDelta: FLY_LATITUDE_DELTA,
        longitudeDelta: FLY_LATITUDE_DELTA,
      },
      500
    );
  }, [ready, selectedId, followSelection, offers, height, bottomInset, topInset]);

  // «Вернуться ко мне».
  useEffect(() => {
    if (!ready || recenterKey === lastRecenter.current) return;
    lastRecenter.current = recenterKey;
    if (!userPosition) return;
    mapRef.current?.animateToRegion(
      {
        latitude: centerLatForInset(userPosition.lat, FLY_LATITUDE_DELTA, height, bottomInset - topInset),
        longitude: userPosition.lng,
        latitudeDelta: FLY_LATITUDE_DELTA,
        longitudeDelta: FLY_LATITUDE_DELTA,
      },
      500
    );
  }, [ready, recenterKey, userPosition, height, bottomInset, topInset]);

  return (
    <View testID="native-map-surface" style={styles.fill} onLayout={(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height)}>
      <MapView
        ref={mapRef}
        style={styles.fill}
        provider={PROVIDER_DEFAULT}
        userInterfaceStyle={theme.mode}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        showsUserLocation={!!userPosition}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onMapReady={() => setReady(true)}
      >
        {offers.map((offer) => (
          <Marker
            key={offer.id}
            coordinate={{ latitude: offer.businessLat, longitude: offer.businessLng }}
            zIndex={offer.id === selectedId ? 1000 : offer.discountPercent}
            accessibilityLabel={`${offer.title}, ${offer.businessName}, −${offer.discountPercent}%`}
            onPress={() => onSelectOffer(offer.id)}
          >
            <PulsingMapPin discountPercent={offer.discountPercent} pickupEnd={offer.pickupEnd} selected={offer.id === selectedId} />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
