import { stripBase, withBase } from "./linking";

describe("linking: базовый путь веб-сборки (GitHub Pages)", () => {
  const base = "/appetite/mobile";
  it("снимает базовый путь с адреса экрана", () => {
    expect(stripBase("/appetite/mobile/profile", base)).toBe("/profile");
    expect(stripBase("/appetite/mobile/offers/o-1?x=1", base)).toBe("/offers/o-1?x=1");
  });
  it("корень приложения — это «/»", () => {
    expect(stripBase("/appetite/mobile", base)).toBe("/");
    expect(stripBase("/appetite/mobile/", base)).toBe("/");
  });
  it("чужие пути и пустая база не трогаются", () => {
    expect(stripBase("/appetite/mobile-other/x", base)).toBe("/appetite/mobile-other/x");
    expect(stripBase("/profile", "")).toBe("/profile");
  });
});

describe("linking: путь маршрута в состоянии", () => {
  it("возвращает базовый путь в route.path на всех уровнях вложенности, не дублируя его", () => {
    const state = { routes: [{ path: "/profile", state: { routes: [{ path: "/offers/o-1" }] } }, { path: "/appetite/mobile/orders" }] };
    expect(withBase(state, "/appetite/mobile")).toEqual({ routes: [{ path: "/appetite/mobile/profile", state: { routes: [{ path: "/appetite/mobile/offers/o-1" }] } }, { path: "/appetite/mobile/orders" }] });
  });
  it("без базы и без состояния ничего не меняет", () => {
    expect(withBase(undefined, "/x")).toBeUndefined();
    const state = { routes: [{ path: "/profile" }] };
    expect(withBase(state, "")).toEqual({ routes: [{ path: "/profile" }] });
  });
});
