import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { getOfferUrgencyRatio, heatColor, type NearbyOffer } from "@apetite/shared";
import { offersApi } from "../../api/offers";
import { useNow } from "../../hooks/useNow";
import { useCountUp } from "../../hooks/useCountUp";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useTheme } from "../../theme/ThemeProvider";
import { sortHotFirst } from "../../utils/offers";
import { getTimeLeft } from "../../utils/time";

/** Центр Санкт-Петербурга (пилот): на экране входа геолокацию не запрашиваем — это витрина, а не поиск. */
const SPB = { lat: 59.9311, lng: 30.3609 };
const RADIUS_KM = 20;
/** Сколько живых предложений проходит перед глазами и как быстро: ~3 с на карточку — «лента», а не слайдшоу. */
const SLIDES = 6;
export const ROTATE_MS = 3200;
const PASS_MS = 340;
const PASS_SHIFT = 36;
const DASH = 10;
const DASH_ACTIVE = 20;
const POSTER_HEIGHT = 212;

type PosterState = { status: "loading" } | { status: "ready"; offers: NearbyOffer[] } | { status: "none" };

/** Самые горячие предложения разных заведений: «предложение дня» первым, дальше по жару и скидке. */
export function pickPosterOffers(offers: NearbyOffer[], limit = SLIDES): NearbyOffer[] {
  const open = offers.filter((offer) => offer.quantityLeft > 0 && !getTimeLeft(offer.pickupEnd).isPast);
  const seen = new Set<string>();
  const picked: NearbyOffer[] = [];
  for (const offer of sortHotFirst(open)) {
    if (seen.has(offer.businessId)) continue;
    seen.add(offer.businessId);
    picked.push(offer);
    if (picked.length === limit) break;
  }
  return picked;
}

/** Что постер сообщает каркасу: жар показанного предложения (красит гало диска на фоне) или null, когда предложений нет. */
export interface PosterScene {
  heat: number | null;
}

/**
 * Постер вместо карточки: гигантская цифра скидки (кинетическая типографика — она «набегает» при смене
 * предложения), под ней блюдо, заведение и «фитиль» — сколько осталось от окна самовывоза. Настоящие предложения
 * витрины (до шести разных заведений) быстро «проходят» карточками: каждое въезжает справа, прежнее уходит влево,
 * ~3 с на карточку; полоски внизу — как в историях, активная заполняется. Нажатие — следующее; пока палец
 * удерживает постер, смена стоит. При «уменьшить движение» — без автосмены и без «пролёта».
 * Это живые данные витрины: вход сразу показывает, ради чего заходят.
 */
export function OfferPoster({ onSceneChange }: { onSceneChange?: (scene: PosterScene) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  // Цифра растёт с шириной экрана, но не выше 88: на узком телефоне она не доезжает до диска на фоне.
  const numeralSize = Math.round(Math.min(88, Math.max(64, screenWidth * 0.225)));
  const now = useNow(30000);
  const [state, setState] = useState<PosterState>({ status: "loading" });
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [held, setHeld] = useState(false);
  const pass = useRef(new Animated.Value(1)).current;
  const dwell = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    offersApi
      .nearby({ lat: SPB.lat, lng: SPB.lng, radiusKm: RADIUS_KM })
      .then((offers) => {
        if (cancelled) return;
        const picked = pickPosterOffers(offers);
        setState(picked.length > 0 ? { status: "ready", offers: picked } : { status: "none" });
      })
      .catch(() => !cancelled && setState({ status: "none" }));
    return () => {
      cancelled = true;
    };
  }, []);

  const count = state.status === "ready" ? state.offers.length : 0;

  /** Перейти к предложению: прежнее остаётся ещё на время «пролёта» (уходит влево), новое въезжает справа. */
  const goTo = useCallback(
    (target: number) => {
      setIndex((current) => {
        if (target === current) return current;
        if (!reduced) {
          setLeaving(current);
          pass.setValue(0);
          Animated.timing(pass, { toValue: 1, duration: PASS_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setLeaving(null));
        }
        return target;
      });
    },
    [reduced, pass]
  );
  const next = useCallback(() => goTo((index + 1) % Math.max(count, 1)), [goTo, index, count]);

  // Автосмена: таймер на одну карточку + полоска «сколько осталось до следующей». Удержание постера ставит её на паузу.
  useEffect(() => {
    if (reduced || count < 2 || held) {
      dwell.stopAnimation();
      return;
    }
    dwell.setValue(0);
    Animated.timing(dwell, { toValue: 1, duration: ROTATE_MS, easing: Easing.linear, useNativeDriver: true }).start();
    const id = setTimeout(() => goTo((index + 1) % count), ROTATE_MS);
    return () => {
      clearTimeout(id);
      dwell.stopAnimation();
    };
  }, [reduced, count, held, index, goTo, dwell]);

  const offer = state.status === "ready" ? state.offers[Math.min(index, count - 1)] : null;
  const shown = useCountUp(offer ? offer.discountPercent : 70, 700);

  const offerId = offer?.id;
  const offerHeat = offer ? (offer.featured ? 0.62 : getOfferUrgencyRatio(offer, now)) : null;
  useEffect(() => {
    onSceneChange?.({ heat: offerId ? offerHeat : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId, offerHeat === null ? null : Math.round(offerHeat * 20), onSceneChange]);

  if (!offer) {
    return (
      <View style={styles.poster} accessibilityRole="text">
        {state.status === "loading" ? (
          <View style={styles.skeletonBlock}>
            <View style={[styles.skeleton, { width: "38%", height: 12 }]} />
            <View style={[styles.skeleton, { width: "70%", height: 62, marginTop: 14 }]} />
          </View>
        ) : (
          <>
            <Text style={styles.kicker}>{t("auth.teaserTitle")}</Text>
            <View style={styles.numeralRow}>
              <Text style={[theme.fonts.bold, styles.lead]}>{t("auth.posterFallbackLead")}</Text>
              <Text style={[theme.fonts.bold, styles.numeral]}>−70</Text>
              <Text style={[theme.fonts.bold, styles.percent]}>%</Text>
            </View>
            <Text style={styles.meta}>{t("auth.teaserFallback")}</Text>
          </>
        )}
      </View>
    );
  }

  /** Всё, что зависит от конкретного предложения: подписи, цвет «фитиля», доля оставшегося окна. */
  const describe = (o: NearbyOffer) => {
    const timeLeft = getTimeLeft(o.pickupEnd, now);
    const timeText =
      timeLeft.hours > 0
        ? t("offerCard.timeLeftHours", { hours: timeLeft.hours, minutes: timeLeft.minutes })
        : t("offerCard.timeLeftMinutes", { minutes: timeLeft.minutes });
    // «Фитиль» — доля окна самовывоза, которая ещё осталась (у суточного предложения почти полный).
    const start = new Date(o.pickupStart).getTime();
    const end = new Date(o.pickupEnd).getTime();
    return {
      kicker: o.featured ? t("auth.teaserFeatured") : t("auth.teaserTitle"),
      left: t("auth.teaserLeft", { time: timeText }),
      remaining: end > start ? Math.min(1, Math.max(0, (end - now) / (end - start))) : 0,
      fuseColor: o.featured ? "#ff8a3d" : heatColor(getOfferUrgencyRatio(o, now), "dark"),
    };
  };
  const current = describe(offer);

  const slide = (o: NearbyOffer, percent: string) => {
    const d = describe(o);
    return (
      <>
        <View style={styles.kickerRow}>
          <View style={[styles.live, o.featured ? null : { backgroundColor: d.fuseColor }]} />
          <Text style={styles.kicker} numberOfLines={1}>
            {d.kicker}
          </Text>
        </View>
        <View style={styles.numeralRow}>
          <Text style={[theme.fonts.bold, styles.numeral, { fontSize: numeralSize, lineHeight: Math.round(numeralSize * 1.09), letterSpacing: -numeralSize * 0.045 }]} accessibilityElementsHidden>
            −{percent}
          </Text>
          <Text style={[theme.fonts.bold, styles.percent, { fontSize: Math.round(numeralSize * 0.43), lineHeight: Math.round(numeralSize * 0.5) }]} accessibilityElementsHidden>
            %
          </Text>
        </View>
        <Text style={[styles.title, styles.onArt]} numberOfLines={1}>
          {o.title}
        </Text>
        <Text style={[styles.meta, styles.metaText, styles.onArt, count > 1 && styles.metaWithDashes]} numberOfLines={1}>
          {o.businessName} · {d.left}
        </Text>
        <View style={styles.fuseTrack}>
          <View style={[styles.fuseFill, { width: `${Math.round(d.remaining * 100)}%`, backgroundColor: d.fuseColor }]}>
            <View style={[styles.spark, { backgroundColor: d.fuseColor, boxShadow: `0 0 10px 2px ${d.fuseColor}aa` }]} />
          </View>
        </View>
      </>
    );
  };

  const enterStyle = {
    opacity: pass,
    transform: [{ translateX: pass.interpolate({ inputRange: [0, 1], outputRange: [PASS_SHIFT, 0] }) }, { scale: pass.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
  };
  const exitStyle = {
    opacity: pass.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ translateX: pass.interpolate({ inputRange: [0, 1], outputRange: [0, -PASS_SHIFT] }) }],
  };
  const leavingOffer = leaving !== null && state.status === "ready" ? state.offers[leaving] : null;

  return (
    <Pressable
      onPress={count > 1 ? next : undefined}
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
      accessibilityRole={count > 1 ? "button" : "text"}
      accessibilityLabel={`${current.kicker}: ${offer.title}, ${offer.businessName}, −${offer.discountPercent}%, ${current.left}${count > 1 ? `. ${t("auth.posterHint")}` : ""}`}
      style={styles.poster}
    >
      {leavingOffer && leavingOffer.id !== offer.id ? (
        // Уходящая карточка: поверх, без касаний и скрыта от скринридера — читается только та, что въехала.
        <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...({ "aria-hidden": true } as object)} style={[styles.leaving, exitStyle]}>
          {slide(leavingOffer, String(leavingOffer.discountPercent))}
        </Animated.View>
      ) : null}
      <Animated.View style={enterStyle}>{slide(offer, String(Math.round(shown)))}</Animated.View>

      {count > 1 && state.status === "ready" ? (
        // Полоски «как в историях»: пройденные залиты, активная заполняется за время показа. Тёмная подложка — читается на любом небе.
        <View style={styles.dashes} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...({ "aria-hidden": true } as object)}>
          {state.offers.map((o, position) => (
            <View key={o.id} style={[styles.dash, position === index && styles.dashActive, position < index && styles.dashDone]}>
              {position === index && !reduced ? (
                <Animated.View style={[styles.dashFill, { transform: [{ translateX: dwell.interpolate({ inputRange: [0, 1], outputRange: [-DASH_ACTIVE, 0] }) }] }]} />
              ) : position === index ? (
                <View style={styles.dashFill} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

// Герой всегда тёмный (картинка бренда) в обеих темах — цвета здесь фиксированные, не из темы.
const styles = StyleSheet.create({
  poster: { minHeight: POSTER_HEIGHT, justifyContent: "flex-end" },
  leaving: { position: "absolute", left: 0, right: 0, bottom: 0 },
  // Под цифрой и «солнцем» текст читается и поверх светлого диска: тень + ограниченная ширина (не заезжает под диск).
  onArt: { maxWidth: "66%", textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff8a3d", boxShadow: "0 0 10px 2px rgba(255,138,61,0.7)" },
  kicker: { flexShrink: 1, fontSize: 12, fontWeight: "700", letterSpacing: 0.9, color: "rgba(255,255,255,0.86)", textTransform: "uppercase" },
  metaText: { marginTop: 3 },
  // Строка с заведением и временем идёт до полосок справа (≈106 px), а не обрезается раньше — «ещё 27 мин» важно дочитать.
  metaWithDashes: { maxWidth: "100%", paddingRight: 106 },
  dashes: { position: "absolute", right: 0, bottom: 23, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.3)" },
  dash: { width: DASH, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.32)" },
  dashActive: { width: DASH_ACTIVE },
  dashDone: { backgroundColor: "rgba(255,255,255,0.85)" },
  dashFill: { width: "100%", height: 3, borderRadius: 2, backgroundColor: "#ffffff" },
  numeralRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },
  lead: { fontSize: 22, color: "rgba(255,255,255,0.8)", marginRight: 8, marginBottom: 14 },
  numeral: { fontSize: 88, lineHeight: 96, letterSpacing: -4, color: "#ffffff" },
  percent: { fontSize: 38, lineHeight: 44, color: "#ff8a3d", marginBottom: 14, marginLeft: 2 },
  title: { marginTop: 2, fontSize: 18, fontWeight: "700", color: "#ffffff" },
  meta: { marginTop: 3, fontSize: 13.5, color: "rgba(255,255,255,0.8)" },
  fuseTrack: { marginTop: 14, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  fuseFill: { height: 3, borderRadius: 2, justifyContent: "center", alignItems: "flex-end" },
  spark: { width: 9, height: 9, borderRadius: 5, marginRight: -4 },
  skeletonBlock: { justifyContent: "flex-end" },
  skeleton: { borderRadius: 8, backgroundColor: "rgba(255,255,255,0.16)" },
});
