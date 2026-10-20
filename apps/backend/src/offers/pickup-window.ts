import { BadRequestException } from "@nestjs/common";
import { normalizeWorkingHours, offerWindowHoursProblem, validateOfferWindow } from "@apetite/shared";

interface PickupWindowOptions {
  /** true — конец окна обязан быть в будущем и не дальше суток (создание оффера или перенос конца окна). */
  requireFuture: boolean;
  now?: Date;
  /** Часы работы заведения: если заданы, окно обязано целиком уложиться в рабочий интервал (заведение закрывается — оффер заканчивается). */
  hours?: { workingHours: unknown; timezone: string } | null;
  /** false — окно не менялось (правка названия/цены старого оффера): часы не проверяем, чтобы не блокировать мелкие правки. */
  checkHours?: boolean;
}

/**
 * Проверка окна самовывоза. Раньше DTO проверяли только формат дат, поэтому через API можно было создать оффер
 * с концом окна раньше начала или уже в прошлом: скидка считалась по отрицательному времени, а витрина
 * получала мёртвое предложение. Теперь ещё и «вечные» офферы: заведения закрываются, предложения обновляются
 * каждые сутки — окно не длиннее OFFER_WINDOW_RULES.MAX_WINDOW_HOURS, конец — не позже чем через сутки.
 */
export function assertValidPickupWindow(start: Date, end: Date, options: PickupWindowOptions): void {
  const nowMs = (options.now ?? new Date()).getTime();
  if (options.requireFuture && end.getTime() <= nowMs) {
    throw new BadRequestException("Окно самовывоза уже закончилось: выбери конец в будущем");
  }
  const problem = validateOfferWindow(start.getTime(), end.getTime(), { nowMs, checkHorizon: options.requireFuture });
  if (problem) throw new BadRequestException(problem);
  if (options.hours?.workingHours && options.checkHours !== false) {
    const hoursProblem = offerWindowHoursProblem(normalizeWorkingHours(options.hours.workingHours), options.hours.timezone, start.getTime(), end.getTime());
    if (hoursProblem) throw new BadRequestException(hoursProblem);
  }
}
