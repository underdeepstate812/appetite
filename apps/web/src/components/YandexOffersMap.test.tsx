import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NearbyOffer } from "@apetite/shared";
import { YandexOffersMap } from "./YandexOffersMap";
import { createFakeYmaps3, type FakeEntity } from "../test/fakeYmaps3";

const offer = (id: string, lat: number, lng: number, discount = 40): NearbyOffer =>
  ({
    id, title: "Борщ " + id, businessName: "Кафе " + id, businessLat: lat, businessLng: lng, discountPercent: discount,
    pickupEnd: new Date(Date.now() + 3 * 3600_000).toISOString(),
  }) as unknown as NearbyOffer;

function setup(overrides: Partial<React.ComponentProps<typeof YandexOffersMap>> = {}) {
  const { api, maps } = createFakeYmaps3();
  const onSelect = vi.fn();
  const base: React.ComponentProps<typeof YandexOffersMap> = {
    api, mapStyle: "scheme", center: { lat: 59.93, lng: 30.36 }, userPosition: null,
    offers: [offer("a", 59.94, 30.31), offer("b", 59.92, 30.4)], selectedId: null, onSelect, fitKey: "k1",
  };
  const view = render(<YandexOffersMap {...base} {...overrides} />);
  const rerender = (next: Partial<typeof base>) => view.rerender(<YandexOffersMap {...base} {...overrides} {...next} />);
  return { maps, onSelect, view, rerender, map: () => maps[0] };
}

const markers = (m: { byKind: (k: string) => FakeEntity[] }) => m.byKind("marker");

describe("YandexOffersMap", () => {
  it("creates the map centred on [lng, lat] (Yandex order) with a scheme layer and offer markers", async () => {
    const { map } = setup();
    await act(async () => {});
    expect(map().props.location).toEqual({ center: [30.36, 59.93], zoom: 13 });
    expect(map().byKind("scheme")).toHaveLength(1);
    expect(markers(map())).toHaveLength(2);
    expect(markers(map())[0].props.coordinates).toEqual([30.31, 59.94]);
  });

  it("clicking a marker selects the offer, and the map click fired by the same gesture does not close it", async () => {
    const { map, onSelect } = setup();
    await act(async () => {});
    (markers(map())[0].props.onClick as () => void)();
    expect(onSelect).toHaveBeenLastCalledWith("a");
    const listener = map().byKind("listener")[0];
    (listener.props.onClick as (o: unknown, e: unknown) => void)(undefined, {});
    expect(onSelect).toHaveBeenCalledTimes(1); // клик карты сразу после пина проигнорирован
  });

  it("clicking empty map closes the card; clicking a map object does not", async () => {
    const { map, onSelect } = setup();
    await act(async () => {});
    const onClick = map().byKind("listener")[0].props.onClick as (o: unknown, e: unknown) => void;
    onClick({ type: "marker" }, {});
    expect(onSelect).not.toHaveBeenCalled();
    onClick(undefined, {});
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("makes markers keyboard-operable (Enter selects)", async () => {
    const { map, onSelect } = setup();
    await act(async () => {});
    const el = markers(map())[1].element as HTMLElement;
    expect(el.getAttribute("role")).toBe("button");
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("highlights the selected pin and flies to it", async () => {
    const { map, rerender } = setup();
    await act(async () => {});
    rerender({ selectedId: "b" });
    const pins = markers(map()).map((m) => m.element!.querySelector(".map-pin")!);
    expect(pins[1].classList.contains("is-selected")).toBe(true);
    expect(pins[0].classList.contains("is-selected")).toBe(false);
    expect(markers(map())[1].props.zIndex).toBe(1000);
    const last = map().updates.at(-1)!.location as { zoom: number; duration: number };
    expect(last.zoom).toBe(16);
    expect(last.duration).toBe(600);
  });

  it("swaps the base layer between scheme and satellite", async () => {
    const { map, rerender } = setup();
    await act(async () => {});
    rerender({ mapStyle: "satellite" });
    expect(map().byKind("scheme")).toHaveLength(0);
    expect(map().byKind("satellite")).toHaveLength(1);
    rerender({ mapStyle: "scheme" });
    expect(map().byKind("satellite")).toHaveLength(0);
    expect(map().byKind("scheme")).toHaveLength(1);
  });

  it("fits bounds only when the data key changes, not on a silent refresh", async () => {
    const { map, rerender } = setup();
    await act(async () => {});
    const fits = () => map().updates.filter((u) => (u.location as { bounds?: unknown })?.bounds).length;
    expect(fits()).toBe(1);
    rerender({ offers: [offer("a", 59.94, 30.31), offer("b", 59.92, 30.4), offer("c", 59.9, 30.3)] }); // тот же fitKey
    expect(fits()).toBe(1);
    rerender({ fitKey: "k2" });
    expect(fits()).toBe(2);
  });

  it("does not collapse to a max-zoom bounds for a single point", async () => {
    const { map } = setup({ offers: [offer("solo", 59.93, 30.36)] });
    await act(async () => {});
    const loc = map().updates[0].location as { center?: number[]; zoom?: number; bounds?: unknown };
    expect(loc.bounds).toBeUndefined();
    expect(loc.zoom).toBe(15);
  });

  it("shows the user's position marker only when it is real", async () => {
    const { map, rerender } = setup();
    await act(async () => {});
    expect(markers(map())).toHaveLength(2);
    rerender({ userPosition: { lat: 59.9, lng: 30.3 } });
    expect(markers(map())).toHaveLength(3);
  });

  it("destroys the map on unmount", async () => {
    const { map, view } = setup();
    await act(async () => {});
    view.unmount();
    expect(map().destroyed).toBe(true);
  });
});
