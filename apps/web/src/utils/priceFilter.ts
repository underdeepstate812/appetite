/** Верхняя граница фильтра: самый дорогой букет на витрине — единицы тысяч; всё выше — опечатка или мусор. */
export const MAX_PRICE_RUB = 100_000;

/** Реальные границы цен предложений (целые рубли): ниже минимума и выше максимума выбрать нельзя — там ничего нет. */
export interface PriceLimits {
  min: number;
  max: number;
  /** Как назвать область в сообщении: «на витрине» / «в категории «Цветы»». */
  scope?: string;
}

export interface PriceBound {
  /** Целые рубли; null — граница не задана. */
  value: number | null;
  error: string | null;
  /** Для ошибок «ниже минимума» / «выше максимума»: допустимое значение, на которое можно исправить одним нажатием. */
  fix: number | null;
}

/**
 * Разбор поля «от» / «до». Пусто — граница не задана (это не ошибка). Принимаем только целые рубли: цены на витрине
 * без копеек, а «1,5», «-5» и «12abc» человек вводит по ошибке — говорим об этом, а не молча «исправляем».
 */
export function parsePriceInput(text: string, limits?: PriceLimits | null): PriceBound {
  const fail = (error: string, fix: number | null = null): PriceBound => ({ value: null, error, fix });
  const raw = text.replace(/[\s\u00a0\u202f]/g, "");
  if (raw === "") return { value: null, error: null, fix: null };
  if (/^-/.test(raw)) return fail("Цена не может быть отрицательной");
  if (/^\d+[.,]\d*$/.test(raw)) return fail("Только целые рубли, без копеек");
  if (!/^\d+$/.test(raw)) return fail("Введите число без букв и знаков");
  const value = Number(raw);
  if (limits) {
    // Границы реальных цен строже общего потолка: «до 99 999» на витрине, где всё дешевле 1 000, — такая же опечатка.
    const scope = limits.scope ?? "на витрине";
    if (value < limits.min) return fail(`Минимальная цена ${scope} — ${formatPriceRub(limits.min)}`, limits.min);
    if (value > limits.max) return fail(`Максимальная цена ${scope} — ${formatPriceRub(limits.max)}`, limits.max);
  } else if (value > MAX_PRICE_RUB) {
    return fail(`Не больше ${formatPriceRub(MAX_PRICE_RUB)}`);
  }
  return { value, error: null, fix: null };
}

export interface PriceRangeCheck {
  min: PriceBound;
  max: PriceBound;
  /** Ошибка, относящаяся к паре полей («от» больше «до»). */
  rangeError: string | null;
  /** Всё в порядке — диапазон можно применять. */
  valid: boolean;
}

/** Проверка пары «от»/«до»: каждое поле само по себе и их согласованность. */
export function checkPriceRange(minText: string, maxText: string, limits?: PriceLimits | null): PriceRangeCheck {
  const min = parsePriceInput(minText, limits);
  const max = parsePriceInput(maxText, limits);
  let fixedMax: PriceBound = max;
  let rangeError: string | null = null;
  // «До 0» ничего не найдёт; с границами цен об этом скажет «ниже минимума», без них — отдельное сообщение.
  if (!limits && !max.error && max.value === 0) fixedMax = { value: null, error: "«До» должно быть больше нуля", fix: null };
  if (!min.error && !fixedMax.error && min.value !== null && fixedMax.value !== null && min.value > fixedMax.value) rangeError = "«От» не может быть больше «до»";
  return { min, max: fixedMax, rangeError, valid: !min.error && !fixedMax.error && !rangeError };
}

export function formatPriceRub(rub: number): string {
  return `${rub.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`.replace(/ /g, " ");
}

/** «от 100 до 500 ₽» / «от 100 ₽» / «до 500 ₽» — для плашки активного фильтра. */
export function describePriceRange(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min.toLocaleString("ru-RU")}–${formatPriceRub(max)}`.replace(/ /g, " ");
  if (min !== null) return `от ${formatPriceRub(min)}`;
  if (max !== null) return `до ${formatPriceRub(max)}`;
  return "";
}
