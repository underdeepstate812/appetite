import { BadRequestException } from "@nestjs/common";

interface PickupWindowOptions {
  /** true — конец окна обязан быть в будущем (создание оффера или перенос конца окна). */
  requireFuture: boolean;
  now?: Date;
}

/**
 * Проверка окна самовывоза. Раньше DTO проверяли только формат дат, поэтому через API можно было создать оффер
 * с концом окна раньше начала или уже в прошлом: скидка считалась по отрицательному времени, а витрина
 * получала мёртвое предложение.
 */
export function assertValidPickupWindow(start: Date, end: Date, options: PickupWindowOptions): void {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException("Некорректная дата окна самовывоза");
  }
  if (end.getTime() <= start.getTime()) {
    throw new BadRequestException("Окно самовывоза: конец должен быть позже начала");
  }
  if (options.requireFuture && end.getTime() <= (options.now ?? new Date()).getTime()) {
    throw new BadRequestException("Окно самовывоза уже закончилось: выбери конец в будущем");
  }
}
