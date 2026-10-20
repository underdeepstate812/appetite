import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { NearbyOffer } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useLocation } from "../../hooks/useLocation";
import { useNearbyOffers, DEFAULT_RADIUS_KM } from "../../hooks/useNearbyOffers";
import { LocationPermissionBanner } from "../../components/LocationPermissionBanner";
import { OfferList } from "../../components/OfferList";
import { EmptyView, ErrorView, LoadingView } from "../../components/StateViews";
import { MapOfferRail, MAP_RAIL_HEIGHT } from "../../components/map/MapOfferRail";
import { MapEmptyCard, MapLocateButton, MapTopBar } from "../../components/map/MapChrome";
import { getTimeLeft } from "../../utils/time";
import { sortHotFirst, sortNearestFirst } from "../../utils/offers";
import { playHaptic } from "../../utils/haptics";
import type { MainTabScreenProps } from "../../navigation/types";

/** Столько первых карточек (горячих/ближайших) карта охватывает при открытии: район, а не весь город. */
export const FIT_COUNT = 12;
/** Шапка: отступ + высота плашки. */
const TOP_BAR = 8 + 44;

type LatLng = { lat: number; lng: number };

/** Что экран просит нарисовать у платформенной карты (Leaflet на web, react-native-maps на native). */
export interface MapSurfaceProps {
  center: LatLng;
  userPosition: LatLng | null;
  offers: NearbyOffer[];
  selectedId: string | null;
  /** Карта летит к выбранному пину (после первого выбора человеком). */
  followSelection: boolean;
  /** Тап по пину. */
  onSelectOffer: (offerId: string) => void;
  /** Высота полос сверху (под шапкой) и снизу (под лентой), закрытых плашками. */
  topInset: number;
  bottomInset: number;
  fitPoints: LatLng[];
  fitKey: string;
  recenterKey: number;
}

interface MapExperienceProps {
  navigation: MainTabScreenProps<"Map">["navigation"];
  renderMap: (props: MapSurfaceProps) => React.ReactNode;
}

/**
 * Вкладка «Карта»: карта на весь экран (под статус-бар), поверх — стеклянная шапка и лента компактных карточек
 * предложений. Карточки и пины — одно целое: листаешь ленту — карта летит к предложению, тапнул пин — лента
 * подъезжает к его карточке; тап по выбранной карточке открывает предложение. Порядок карточек — ближайшие первыми,
 * когда позиция известна, иначе горящие первыми (как на «Сейчас»). Список по-прежнему доступен — кнопкой в шапке.
 * Платформенная карта приходит через renderMap: логика выбора одна для web и native.
 */
export function MapExperience({ navigation, renderMap }: MapExperienceProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { location, loading: locationLoading, status: locationStatus, requestPermission, openSettings } = useLocation();
  const { offers, error, refreshing, refresh } = useNearbyOffers(location, { radiusKm: DEFAULT_RADIUS_KM });

  const [listMode, setListMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [followSelection, setFollowSelection] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);

  const located = !!location && !location.isFallback && locationStatus === "granted";

  // Порядок фиксируем на момент загрузки данных (а не на каждый «тик» времени): иначе карточки менялись бы местами
  // под пальцем, пока человек листает ленту. Закрытые окна и раскупленные предложения на карте ни к чему.
  const ordered = useMemo(() => {
    const open = (offers ?? []).filter((offer) => offer.quantityLeft > 0 && !getTimeLeft(offer.pickupEnd).isPast);
    return located ? sortNearestFirst(open) : sortHotFirst(open);
  }, [offers, located]);

  // Выбранная карточка всегда существует: пока человек ничего не выбирал — первая; пропала из выдачи — снова первая.
  useEffect(() => {
    if (ordered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !ordered.some((offer) => offer.id === selectedId)) setSelectedId(ordered[0].id);
  }, [ordered, selectedId]);

  const select = useCallback((offerId: string) => {
    setSelectedId((current) => {
      if (current !== offerId) playHaptic("select");
      return offerId;
    });
    setFollowSelection(true);
  }, []);

  const open = useCallback(
    (offerId: string) => navigation.navigate("OfferDetail", { offerId }),
    [navigation]
  );

  const handleLocate = () => {
    if (locationStatus === "blocked") openSettings();
    else if (!located) void requestPermission();
    else setRecenterKey((key) => key + 1);
  };

  const fitPoints = useMemo(() => ordered.slice(0, FIT_COUNT).map((offer) => ({ lat: offer.businessLat, lng: offer.businessLng })), [ordered]);
  const fitKey = `${located ? "me" : "city"}|${ordered.length > 0 ? "data" : "none"}`;

  if (locationLoading || (offers === null && !error)) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <LoadingView label={t("common.loading")} />
      </View>
    );
  }

  if (error && offers === null) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <ErrorView label={error} onRetry={refresh} />
      </View>
    );
  }

  const bottomInset = MAP_RAIL_HEIGHT + 8;
  const topInset = insets.top + TOP_BAR;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      {listMode ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.listContent, { paddingTop: topInset + 12 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          showsVerticalScrollIndicator={false}
        >
          <LocationPermissionBanner status={locationStatus} onRequest={requestPermission} onOpenSettings={openSettings} />
          {ordered.length === 0 ? (
            <EmptyView label={t("home.emptyNow")} />
          ) : (
            <OfferList offers={ordered} onPressOffer={(offer) => open(offer.id)} />
          )}
        </ScrollView>
      ) : (
        <>
          <View style={styles.flex}>
            {location
              ? renderMap({
                  center: { lat: location.lat, lng: location.lng },
                  userPosition: located ? { lat: location.lat, lng: location.lng } : null,
                  offers: ordered,
                  selectedId,
                  followSelection,
                  onSelectOffer: select,
                  topInset,
                  bottomInset,
                  fitPoints,
                  fitKey,
                  recenterKey,
                })
              : null}
          </View>
          {/* Выше строки атрибуции OSM (она по лицензии должна быть видна и поднята над лентой): иначе кнопка закрывала бы её конец. */}
          <MapLocateButton located={located} onPress={handleLocate} bottom={bottomInset + 30} />
          {ordered.length > 0 ? (
            <MapOfferRail offers={ordered} selectedId={selectedId} onSelect={select} onOpen={open} style={[styles.rail, { bottom: 0 }]} />
          ) : (
            <MapEmptyCard bottom={14} />
          )}
        </>
      )}
      <MapTopBar count={ordered.length} listMode={listMode} onToggle={() => setListMode((value) => !value)} topInset={insets.top} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  rail: { position: "absolute", left: 0, right: 0, zIndex: 4 },
  listContent: { padding: 16, paddingBottom: 24 },
});
