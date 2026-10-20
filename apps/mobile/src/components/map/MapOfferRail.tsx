import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, FlatList, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { NearbyOffer } from "@apetite/shared";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { indexFromOffset, indexOfOffer, offsetForIndex, railMetrics } from "../../utils/mapRail";
import { MAP_CARD_HEIGHT, MapOfferCard } from "./MapOfferCard";

/** Сколько ждём тишины в прокрутке, прежде чем считать, что карточка «встала» (на RN-web momentum-событий нет). */
const SETTLE_MS = 120;

/** Высота ленты вместе с тенью — столько карта должна оставлять внизу пустым. */
export const MAP_RAIL_HEIGHT = MAP_CARD_HEIGHT + 24;

interface MapOfferRailProps {
  offers: NearbyOffer[];
  selectedId: string | null;
  /** Карточка выбрана (листанием, касанием, фокусом) — карта летит к её пину. */
  onSelect: (offerId: string) => void;
  /** Открыть предложение. */
  onOpen: (offerId: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Лента компактных карточек под картой: листается пальцем с «прилипанием» (snap), центральная карточка крупнее и ярче
 * (глубина — соседние чуть меньше и приглушены), а выбор синхронен с пинами: листаешь ленту — карта едет к предложению,
 * тапнул пин — лента подъезжает к его карточке. Сначала горящие/ближайшие (порядок задаёт экран).
 */
export function MapOfferRail({ offers, selectedId, onSelect, onOpen, style }: MapOfferRailProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const metrics = useMemo(() => railMetrics(width), [width]);
  const listRef = useRef<FlatList<NearbyOffer>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const lastX = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Идёт прокрутка, которую начали мы (после тапа по пину): её итог не нужно «выбирать» заново. */
  const programmatic = useRef(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const settle = useCallback(() => {
    const index = indexFromOffset(lastX.current, metrics.snap, offers.length);
    const offer = offers[index];
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    if (offer && offer.id !== selectedRef.current) {
      onSelect(offer.id);
    }
  }, [metrics.snap, offers, onSelect]);

  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          lastX.current = event.nativeEvent.contentOffset.x;
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(settle, SETTLE_MS);
        },
      }),
    [scrollX, settle]
  );

  useEffect(() => () => void (settleTimer.current && clearTimeout(settleTimer.current)), []);

  // Выбор пришёл снаружи (тап по пину): подъезжаем к карточке, если лента ещё не там.
  useEffect(() => {
    const index = indexOfOffer(offers, selectedId);
    if (index < 0) return;
    const target = offsetForIndex(index, metrics.snap);
    if (Math.abs(lastX.current - target) < 4) return;
    programmatic.current = true;
    listRef.current?.scrollToOffset({ offset: target, animated: !reduced });
    lastX.current = target;
    // Если прокрутка ничего не сдвинула (уже на месте), событие «встала» не придёт — флаг снимаем сами.
    const guard = setTimeout(() => (programmatic.current = false), 700);
    return () => clearTimeout(guard);
  }, [selectedId, offers, metrics.snap, reduced]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<NearbyOffer>) => {
      const range = [(index - 1) * metrics.snap, index * metrics.snap, (index + 1) * metrics.snap];
      const depth = reduced
        ? null
        : {
            opacity: scrollX.interpolate({ inputRange: range, outputRange: [0.82, 1, 0.82], extrapolate: "clamp" }),
            transform: [{ scale: scrollX.interpolate({ inputRange: range, outputRange: [0.94, 1, 0.94], extrapolate: "clamp" }) }],
          };
      return (
        <Animated.View style={[{ width: metrics.snap, paddingRight: metrics.gap }, depth]}>
          <MapOfferCard offer={item} width={metrics.cardWidth} selected={item.id === selectedId} onSelect={onSelect} onOpen={onOpen} />
        </Animated.View>
      );
    },
    // selectedId — в зависимостях: при смене выбора renderItem новый, и FlatList перерисовывает ячейки (extraData).
    [metrics, reduced, scrollX, onSelect, onOpen, selectedId]
  );

  const getItemLayout = useCallback((_: ArrayLike<NearbyOffer> | null | undefined, index: number) => ({ length: metrics.snap, offset: metrics.snap * index, index }), [metrics.snap]);

  return (
    // «group», а не «list»: у списка по ARIA обязаны быть дети-listitem (axe: aria-required-children), а ячейки FlatList — кнопки
    // в промежуточных div, и <li> там нарушил бы уже другое правило. Группа с подписью читается как «Предложения на карте».
    <View style={[styles.wrap, style]} role="group" accessibilityLabel={t("map.cardsLabel")}>
      <Animated.FlatList
        ref={listRef as React.Ref<never>}
        data={offers}
        extraData={selectedId}
        keyExtractor={(offer) => offer.id}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={metrics.snap}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingLeft: metrics.inset, paddingRight: metrics.inset - metrics.gap, paddingVertical: 10 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        onScrollToIndexFailed={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: MAP_RAIL_HEIGHT },
});
