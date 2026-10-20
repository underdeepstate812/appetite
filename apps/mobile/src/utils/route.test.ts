import { routeUrl } from "./route";

describe("routeUrl", () => {
  it("opens Apple Maps on iOS and a geo: intent on Android", () => {
    expect(routeUrl(59.9, 30.3, "Кафе", "ios")).toBe("maps://?daddr=59.9,30.3&q=%D0%9A%D0%B0%D1%84%D0%B5");
    expect(routeUrl(59.9, 30.3, "Кафе", "android")).toBe("geo:0,0?q=59.9,30.3(%D0%9A%D0%B0%D1%84%D0%B5)");
  });

  it("falls back to OpenStreetMap on the web", () => {
    expect(routeUrl(59.9, 30.3, "Кафе", "web")).toBe("https://www.openstreetmap.org/?mlat=59.9&mlon=30.3#map=17/59.9/30.3");
  });

  it("encodes characters that would break the URL", () => {
    expect(routeUrl(1, 2, "Café (центр) & «бар»", "android")).not.toMatch(/[ «»&]/);
  });
});
