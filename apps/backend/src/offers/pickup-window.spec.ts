import { BadRequestException } from "@nestjs/common";
import { assertValidPickupWindow } from "./pickup-window";

const HOUR = 3_600_000;
const NOW = new Date("2026-10-18T12:00:00Z");
const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR);
const check = (startH: number, endH: number, requireFuture = true) => () => assertValidPickupWindow(at(startH), at(endH), { requireFuture, now: NOW });

describe("assertValidPickupWindow: офферы обновляются каждые сутки", () => {
  it("обычное вечернее окно проходит", () => expect(check(-1, 4)).not.toThrow());
  it("окно ровно 12 часов проходит, 12 ч 1 мин — нет", () => {
    expect(check(0, 12)).not.toThrow();
    expect(() => assertValidPickupWindow(at(0), new Date(at(12).getTime() + 60_000), { requireFuture: true, now: NOW })).toThrow(/не длиннее 12 часов/);
  });
  it("«оффер дня» на 24 часа (как на скриншоте: 22 ч до конца) невозможен", () => {
    expect(check(0, 24)).toThrow(BadRequestException);
    expect(check(-1, 23)).toThrow(/не длиннее 12/);
  });
  it("короткое окно, но конец дальше суток — тоже нельзя (оффер не висит дольше суток)", () => {
    expect(check(25, 29)).toThrow(/в течение суток|не может висеть дольше 24/);
    expect(check(20, 24)).not.toThrow(); // конец ровно через 24 часа — ещё можно
  });
  it("конец раньше начала и в прошлом — прежние ошибки", () => {
    expect(check(3, 2)).toThrow(/позже начала/);
    expect(check(-5, -1)).toThrow(/уже закончилось/);
  });
  it("старый оффер без переноса конца (архивация) горизонт не проверяет", () => {
    expect(check(-30, -28, false)).not.toThrow();
  });
});
