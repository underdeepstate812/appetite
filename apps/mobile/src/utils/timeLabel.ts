import type { TFunction } from "i18next";
import type { TimeLeft } from "./time";

/** «1 ч 25 мин» / «34 мин» / «Забор завершён» — одна подпись и для глаз (TimeLeftText), и для скринридера (карточки на карте). */
export function timeLeftLabel(t: TFunction, timeLeft: TimeLeft): string {
  if (timeLeft.isPast) return t("offerCard.pickupClosed");
  return timeLeft.hours > 0
    ? t("offerCard.timeLeftHours", { hours: timeLeft.hours, minutes: timeLeft.minutes })
    : t("offerCard.timeLeftMinutes", { minutes: timeLeft.minutes });
}
