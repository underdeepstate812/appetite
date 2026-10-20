import {
  checkWindowAgainstHours, closingTimeAt, defaultWorkingHours, describeHoursProblem, describeWorkingHours, normalizeWorkingHours,
  offerWindowHoursProblem, scheduleHoursProblem, validateWorkingHours, type WorkingHours,
} from "@apetite/shared";

const MSK = "Europe/Moscow";
const base = (): WorkingHours => ({ ...defaultWorkingHours(), "7": null }); // пн–сб 10:00–22:00, вс выходной
const min = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const problem = (h: WorkingHours, weekday: number, start: string, durationH: number) => describeHoursProblem(checkWindowAgainstHours(h, weekday, min(start), durationH * 60));

describe("часы работы: окно самовывоза против интервала", () => {
  it("внутри часов — можно; ровно до закрытия — можно", () => {
    expect(problem(base(), 1, "18:00", 3)).toBeNull();
    expect(problem(base(), 1, "10:00", 12)).toBeNull();
  });
  it("после закрытия — отказ с временем закрытия", () => {
    expect(problem(base(), 1, "21:00", 2)).toBe("Заведение в понедельник закрывается в 22:00: самовывоз должен закончиться не позже");
  });
  it("до открытия — отказ с временем открытия", () => expect(problem(base(), 2, "08:30", 1)).toMatch(/во вторник открывается в 10:00/));
  it("уже закрыто", () => expect(problem(base(), 3, "22:30", 1)).toMatch(/в среду уже закрыто \(работает 10:00–22:00\)/));
  it("выходной день", () => expect(problem(base(), 7, "12:00", 2)).toBe("Заведение в воскресенье не работает — выберите рабочий день или измените часы работы"));

  it("работа за полночь: пт 18:00–02:00, окно через полночь внутри интервала", () => {
    const h = { ...base(), "5": { open: "18:00", close: "02:00" } };
    expect(problem(h, 5, "23:00", 2.5)).toBeNull(); // до 01:30
    expect(problem(h, 5, "23:00", 4)).toMatch(/закрывается в 02:00/);
    expect(problem(h, 6, "00:30", 1)).toBeNull(); // уже суббота, но это пятничная смена
    expect(problem(h, 6, "01:30", 1)).toMatch(/закрывается в 02:00/);
  });

  it("круглосуточно: любое окно подходит, в том числе через полночь и несколько суток подряд", () => {
    const all = Object.fromEntries(["1", "2", "3", "4", "5", "6", "7"].map((k) => [k, { open: "00:00", close: "00:00" }])) as WorkingHours;
    expect(problem(all, 7, "22:00", 6)).toBeNull();
    expect(problem(all, 3, "00:00", 12)).toBeNull();
  });

  it("смена пн→вт без перерыва (вт открывается в момент закрытия пн) склеивается", () => {
    const h = { ...base(), "1": { open: "12:00", close: "00:00" }, "2": { open: "00:00", close: "06:00" } };
    expect(problem(h, 1, "22:00", 5)).toBeNull();
    expect(problem(h, 1, "22:00", 8)).toBeNull(); // до 06:00 включительно
    expect(problem(h, 1, "22:00", 9)).toMatch(/закрывается в 06:00/);
  });
});

describe("часы работы: конкретный оффер и шаблон", () => {
  // 19.10.2026 — понедельник; 14:00Z = 17:00 МСК
  const at = (hhmmUtc: string, day = 19) => Date.parse(`2026-10-${day}T${hhmmUtc}:00Z`);
  it("оффер без заданных часов не ограничивается", () => expect(offerWindowHoursProblem(null, MSK, at("10:00"), at("20:00"))).toBeNull());
  it("оффер читается в поясе заведения: 17:00–19:00 МСК (пн) — можно, до 23:30 МСК — нельзя", () => {
    expect(offerWindowHoursProblem(base(), MSK, at("14:00"), at("16:00"))).toBeNull();
    expect(offerWindowHoursProblem(base(), MSK, at("14:00"), at("20:30"))).toMatch(/закрывается в 22:00/);
  });
  it("тот же момент в другом поясе даёт другой вердикт (Владивосток UTC+10: 14:00Z = 00:00 — закрыто)", () => {
    expect(offerWindowHoursProblem(base(), "Asia/Vladivostok", at("14:00"), at("15:00"))).toMatch(/не работает|уже закрыто|открывается/);
  });
  it("шаблон: все выбранные дни должны помещаться; воскресенье (выходной) — отказ", () => {
    expect(scheduleHoursProblem(base(), { daysOfWeek: [1, 2, 3], pickupStartTime: "17:00", pickupEndTime: "21:00" })).toBeNull();
    expect(scheduleHoursProblem(base(), { daysOfWeek: [1, 7], pickupStartTime: "17:00", pickupEndTime: "21:00" })).toMatch(/в воскресенье не работает/);
    expect(scheduleHoursProblem(base(), { daysOfWeek: [1], pickupStartTime: "20:00", pickupEndTime: "23:00" })).toMatch(/закрывается в 22:00/);
    expect(scheduleHoursProblem(null, { daysOfWeek: [7], pickupStartTime: "20:00", pickupEndTime: "23:00" })).toBeNull();
  });
  it("закрытие, внутри которого находится момент: 15:00 МСК пн → 22:00 МСК; в выходной и ночью — null", () => {
    expect(closingTimeAt(base(), MSK, at("12:00"))).toBe(at("19:00"));
    expect(closingTimeAt(base(), MSK, at("12:00", 18))).toBeNull(); // воскресенье
    expect(closingTimeAt(base(), MSK, at("02:00"))).toBeNull(); // 05:00 МСК — ещё закрыто
  });
});

describe("часы работы: проверка формата и подпись", () => {
  it.each([
    [null, /объект/], [[], /объект/], [{}, /хотя бы один/], [{ "8": { open: "10:00", close: "20:00" } }, /неизвестные дни/],
    [{ "1": { open: "9:00", close: "20:00" } }, /ЧЧ:ММ/], [{ "1": "10-20" }, /\{open, close\}/], [{ "1": null, "2": null }, /хотя бы один/],
  ])("отклоняет %j", (value, message) => expect(validateWorkingHours(value)).toMatch(message as RegExp));
  it("принимает полный и неполный набор дней; normalize добавляет недостающие как выходные", () => {
    expect(validateWorkingHours({ "1": { open: "10:00", close: "20:00" } })).toBeNull();
    expect(normalizeWorkingHours({ "3": { open: "10:00", close: "20:00" } })).toEqual({ "1": null, "2": null, "3": { open: "10:00", close: "20:00" }, "4": null, "5": null, "6": null, "7": null });
  });
  it("подпись сворачивает одинаковые подряд дни", () => {
    expect(describeWorkingHours({ ...base(), "6": { open: "11:00", close: "23:00" } })).toBe("пн–пт 10:00–22:00 · сб 11:00–23:00 · вс выходной");
    expect(describeWorkingHours(null)).toBe("");
  });
});
