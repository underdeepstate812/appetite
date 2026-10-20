import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import type { NearbyOffer } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useMarquee } from "../../hooks/useMarquee";
import { useUniqueId } from "../../hooks/useUniqueId";
import { RIBBON_CARD_HEIGHT, RIBBON_GAP, RIBBON_MIN_TO_DRIFT, RIBBON_SPEED, ribbonGeometry } from "../../utils/ribbon";
import { RibbonOfferCard, type HoldSource } from "./RibbonOfferCard";

const FADE = 30;

interface OfferRibbonProps {
  offers: NearbyOffer[];
  onPressOffer: (offer: NearbyOffer) => void;
  /** Экран на виду: пока вкладка не открыта, лента не едет (иначе анимация жгла бы батарею под чужим экраном). */
  active?: boolean;
  /** Отрицательные боковые поля родителя: лента выходит к краям экрана. */
  bleed?: number;
}

/**
 * «Проезжающая» лента предложений над картой на вкладке «Сейчас»: карточки плывут справа налево без остановки и без шва
 * (набор повторяется), края гаснут в фон. Можно нажать на карточку — откроется предложение; пока палец, указатель или
 * клавиатурный фокус на ленте, она замирает (нельзя промахнуться по уезжающему и можно дочитать). Для скринридера —
 * подписанная группа обычных кнопок (копии петли скрыты). «Уменьшить движение» или меньше трёх предложений — вместо
 * дрейфа обычная горизонтальная прокрутка пальцем.
 */
export function OfferRibbon({ offers, onPressOffer, active = true, bleed = 0 }: OfferRibbonProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const uid = useUniqueId("ribbon");
  const [width, setWidth] = useState(0);
  // Кто «держит» ленту: у каждого источника (палец, указатель, фокус) — id карточки. Идемпотентно и без счётчика: уход с одной
  // карточки на соседнюю и потерянное событие «убрали» не оставляют ленту замороженной.
  const [holders, setHolders] = useState<Record<HoldSource, string | null>>({ press: null, hover: null, focus: null });
  const held = holders.press !== null || holders.hover !== null || holders.focus !== null;

  const drift = !reduced && offers.length >= RIBBON_MIN_TO_DRIFT;
  const { setWidth: loop, copies } = useMemo(() => ribbonGeometry(offers.length, width), [offers.length, width]);
  const x = useMarquee(loop, RIBBON_SPEED, drift && active && !held && width > 0);

  const handleHold = useCallback((source: HoldSource, id: string, on: boolean) => {
    setHolders((current) => (on ? (current[source] === id ? current : { ...current, [source]: id }) : current[source] === id ? { ...current, [source]: null } : current));
  }, []);

  // Страховка: потерянное событие «убрали палец/указатель» не должно оставить ленту замороженной навсегда.
  useEffect(() => {
    setHolders({ press: null, hover: null, focus: null });
  }, [active, offers.length]);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  const edge = theme.colors.background;
  const label = t("home.ribbonLabel");

  return (
    <View style={[styles.wrap, { marginHorizontal: -bleed }]}>
      <View style={[styles.titleRow, { paddingHorizontal: bleed }]}>
        <View style={[styles.live, { backgroundColor: theme.colors.ember }]} />
        <Text style={[styles.title, { color: theme.colors.text }]} accessibilityRole="header">
          {t("home.ribbonTitle")}
        </Text>
        <Text style={[styles.count, { color: theme.colors.textMuted }]}>{offers.length}</Text>
      </View>

      <View style={styles.viewport} onLayout={onLayout} role="group" accessibilityLabel={label} testID="offer-ribbon" {...({ dataSet: { held: held ? "1" : "0" } } as object)}>
        {drift ? (
          loop > 0 && width > 0 ? (
            <Animated.View style={[styles.track, { width: loop * copies, transform: [{ translateX: x }] }]} testID="offer-ribbon-track">
              {Array.from({ length: copies }).map((_, copy) =>
                offers.map((offer) => (
                  <View key={`${copy}-${offer.id}`} style={styles.slot}>
                    <RibbonOfferCard offer={offer} onPress={onPressOffer} decorative={copy > 0} onHold={(source, on) => handleHold(source, `${copy}-${offer.id}`, on)} />
                  </View>
                ))
              )}
            </Animated.View>
          ) : null
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingHorizontal: bleed }]}>
            {offers.map((offer) => (
              <View key={offer.id} style={styles.slot}>
                <RibbonOfferCard offer={offer} onPress={onPressOffer} />
              </View>
            ))}
          </ScrollView>
        )}
        {drift ? (
          // Края гаснут в цвет фона: карточки «выплывают» и «уплывают», а не режутся по линии.
          <View pointerEvents="none" style={StyleSheet.absoluteFill} {...({ "aria-hidden": true } as object)}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id={`${uid}-l`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={edge} stopOpacity={1} />
                  <Stop offset="1" stopColor={edge} stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id={`${uid}-r`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={edge} stopOpacity={0} />
                  <Stop offset="1" stopColor={edge} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={FADE} height="100%" fill={`url(#${uid}-l)`} />
              <Rect x={Math.max(0, width - FADE)} y="0" width={FADE} height="100%" fill={`url(#${uid}-r)`} />
            </Svg>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  live: { width: 8, height: 8, borderRadius: 4, boxShadow: "0 0 10px 2px rgba(255,138,61,0.6)" },
  title: { fontSize: 12, fontWeight: "800", letterSpacing: 0.9, textTransform: "uppercase" },
  count: { fontSize: 12, fontWeight: "700" },
  // Высота с запасом на тень карточки; overflow скрывает всё, что уехало за край.
  viewport: { height: RIBBON_CARD_HEIGHT + 14, overflow: "hidden", justifyContent: "center" },
  track: { flexDirection: "row", alignItems: "center" },
  scroll: { alignItems: "center" },
  slot: { marginRight: RIBBON_GAP, height: RIBBON_CARD_HEIGHT + 14, justifyContent: "center" },
});
