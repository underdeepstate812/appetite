import * as Haptics from "expo-haptics";

/**
 * Тактильный язык приложения. Каждое событие — небольшая партитура из импульсов, а не
 * одиночный "бзз": вес импульса совпадает с весом события (лёгкий — выбор, тяжёлый —
 * подтверждение), а тайминги привязаны к визуальным биениям анимации (см. CelebrationBurst).
 * Работает поверх expo-haptics: iOS — Taptic Engine, Android/web — вибромотор.
 */
type Pulse =
  | "select"
  | "soft"
  | "light"
  | "medium"
  | "heavy"
  | "rigid"
  | "success"
  | "warning"
  | "error";

interface Step {
  /** Через сколько мс от старта партитуры. */
  at: number;
  pulse: Pulse;
}

export type HapticKind = "select" | "tap" | "tick" | "thud" | "success" | "confirm" | "accepted" | "warning" | "error";

export const HAPTIC_SCORES: Record<HapticKind, readonly Step[]> = {
  select: [{ at: 0, pulse: "select" }],
  tap: [{ at: 0, pulse: "light" }],
  tick: [{ at: 0, pulse: "rigid" }],
  // Один тяжёлый импульс / одно "успешно" — для режима "уменьшить движение" вместо партитур.
  thud: [{ at: 0, pulse: "medium" }],
  success: [{ at: 0, pulse: "success" }],
  // Оплата подтверждена: кольцо на экране замыкается на 360 мс — в этот момент "замок" (rigid),
  // следом мягкое "осело" (soft). Шаг между импульсами ≥80 мс, иначе Taptic смазывает.
  confirm: [
    { at: 360, pulse: "rigid" },
    { at: 450, pulse: "soft" },
  ],
  // Заказ принят: сразу "успешно", затем три лёгких тика в такт клавишам PIN (560/680/800) и
  // мягкое "осело" на 1000 мс, когда билет допечатан.
  accepted: [
    { at: 0, pulse: "success" },
    { at: 560, pulse: "light" },
    { at: 680, pulse: "light" },
    { at: 800, pulse: "light" },
    { at: 1000, pulse: "soft" },
  ],
  warning: [{ at: 0, pulse: "warning" }],
  error: [
    { at: 0, pulse: "error" },
    { at: 140, pulse: "light" },
  ],
};

function fire(pulse: Pulse): void {
  const swallow = () => {};
  switch (pulse) {
    case "select":
      Haptics.selectionAsync().catch(swallow);
      return;
    case "success":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(swallow);
      return;
    case "warning":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(swallow);
      return;
    case "error":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(swallow);
      return;
    case "soft":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(swallow);
      return;
    case "light":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(swallow);
      return;
    case "medium":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(swallow);
      return;
    case "heavy":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(swallow);
      return;
    case "rigid":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(swallow);
      return;
  }
}

let running: ReturnType<typeof setTimeout>[] = [];

function cancelRunning(): void {
  running.forEach(clearTimeout);
  running = [];
}

/**
 * Проигрывает партитуру. Длинные (confirm/accepted) вытесняют друг друга, чтобы две
 * партитуры подряд не смешивались в кашу; короткие одиночные импульсы ничего не сбрасывают.
 * Возвращает функцию отмены.
 */
export function playHaptic(kind: HapticKind): () => void {
  const score = HAPTIC_SCORES[kind];
  if (score.length > 1) cancelRunning();

  const timers = score.map((step) => {
    if (step.at === 0) {
      fire(step.pulse);
      return null;
    }
    const timer = setTimeout(() => fire(step.pulse), step.at);
    running.push(timer);
    return timer;
  });

  return () => {
    timers.forEach((timer) => timer && clearTimeout(timer));
  };
}
