import { useCallback, useEffect, useMemo, useRef, type FocusEventHandler, type PointerEventHandler, type RefObject, type TouchEventHandler, type WheelEventHandler } from "react";

/** Скорость «дрейфа» ленты, px/с: читаемый темп бегущей строки (как на ленте лендинга, ~30 px/с). */
export const DRIFT_PX_PER_S = 34;
/** Сколько лента стоит после того, как человек сам её листал (палец/колесо/трекпад): дальше она плавно продолжает. */
export const USER_IDLE_MS = 2500;

interface Options {
  /** Лента едет сама. */
  playing: boolean;
  /** В ленте есть вторая копия карточек (`.showcase-item.is-clone`) — без неё бесшовной петли не получится. */
  loops: boolean;
  /** Любое значение, меняющееся вместе с набором карточек: заставляет эффект заново найти ленту в DOM. */
  itemsKey: unknown;
}

/**
 * Автоматическая прокрутка ленты по кругу. Едет, пока человек ею не занят: наведена мышь (только мышь — касание
 * «зависает» без парного pointerleave), в ленте клавиатурный фокус, пальцем/колесом листали недавно, лента вне экрана.
 * Движение не должно отнимать управление (WCAG 2.2.2) — поэтому снаружи есть кнопка паузы и учёт prefers-reduced-motion.
 * Возвращает обработчики для обёртки ленты.
 */
export function useRailDrift(railRef: RefObject<HTMLElement | null>, wrapRef: RefObject<HTMLElement | null>, { playing, loops, itemsKey }: Options) {
  const hovered = useRef(false);
  const focused = useRef(false);
  const activeUntil = useRef(0);
  const visible = useRef(true);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const userTouched = useCallback(() => {
    activeUntil.current = performance.now() + USER_IDLE_MS;
  }, []);

  // Лента вне экрана (человек у карты ниже) не едет: незачем жечь кадры и «убегать» из-под взгляда при возврате.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof IntersectionObserver === "undefined") return;
    // isIntersecting тут не годится: он «истина» при любом касании краем экрана, а нужна заметная часть ленты в кадре.
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.intersectionRatio >= 0.15;
    }, {
      threshold: [0, 0.15],
      // Верх экрана занимает плавающая шапка (14 px + --header-height): лента, выглядывающая из-под неё, человеку не видна.
      rootMargin: "-90px 0px 0px 0px",
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [wrapRef, itemsKey]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !loops) return;
    let raf = 0;
    let last = performance.now();
    // Позицию копим дробной: браузеры округляют scrollLeft до целого, и `scrollLeft += 0.5` на части платформ молча терялось.
    let pos = rail.scrollLeft;

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const first = rail.querySelector<HTMLElement>(".showcase-item");
      const clone = rail.querySelector<HTMLElement>(".showcase-item.is-clone");
      // Ширина одной «петли» — расстояние между началом оригинала и началом копии (учитывает и зазоры, и отступы).
      const loopWidth = first && clone ? clone.offsetLeft - first.offsetLeft : 0;
      if (loopWidth > 0) {
        const busy = hovered.current || focused.current || now < activeUntil.current;
        if (busy || !visible.current || !playingRef.current) {
          pos = rail.scrollLeft; // стоим — человек мог сдвинуть ленту сам: продолжим с того места
        } else {
          if (Math.abs(rail.scrollLeft - pos) > 2) pos = rail.scrollLeft;
          pos += (DRIFT_PX_PER_S * dt) / 1000;
          if (pos >= loopWidth) pos -= loopWidth;
          rail.scrollLeft = pos;
        }
        // Дошли до копии (в т.ч. руками) — незаметно перескакиваем на то же место оригинала.
        if (!busy && rail.scrollLeft >= loopWidth) {
          rail.scrollLeft -= loopWidth;
          pos = rail.scrollLeft;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [railRef, loops, itemsKey]);

  const onPointerEnter: PointerEventHandler = useCallback((event) => {
    if (event.pointerType === "mouse") hovered.current = true;
  }, []);
  const onPointerLeave: PointerEventHandler = useCallback((event) => {
    if (event.pointerType === "mouse") hovered.current = false;
  }, []);
  const onFocus: FocusEventHandler = useCallback(() => {
    focused.current = true;
  }, []);
  const onBlur: FocusEventHandler = useCallback(() => {
    focused.current = false;
  }, []);
  const onTouchStart: TouchEventHandler = userTouched;
  const onWheel: WheelEventHandler = userTouched;

  return useMemo(
    () => ({ onPointerEnter, onPointerLeave, onFocus, onBlur, onTouchStart, onTouchMove: userTouched as TouchEventHandler, onTouchEnd: userTouched as TouchEventHandler, onWheel }),
    [onPointerEnter, onPointerLeave, onFocus, onBlur, onTouchStart, onWheel, userTouched]
  );
}
