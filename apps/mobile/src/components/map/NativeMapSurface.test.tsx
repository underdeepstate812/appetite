import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { NativeMapSurface } from "./NativeMapSurface";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { centerLatForInset } from "../../utils/mapRail";
import { makeNearbyOffer } from "../../test/fixtures";
import type { MapSurfaceProps } from "../../screens/map/MapExperience";

// Настоящий react-native-maps в jest не живёт (нужен нативный модуль): подставляем карту с теми же методами и событиями.
jest.mock("react-native-maps", () => {
  const React = require("react");
  const { Pressable, View } = require("react-native");
  const methods = { fitToCoordinates: jest.fn(), animateToRegion: jest.fn() };
  const MapView = React.forwardRef((props: { onMapReady?: () => void; children?: React.ReactNode; onLayout?: never }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => methods);
    React.useEffect(() => props.onMapReady?.(), []);
    return <View testID="map">{props.children}</View>;
  });
  const Marker = (props: { onPress?: () => void; accessibilityLabel?: string; zIndex?: number; children?: React.ReactNode }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={props.accessibilityLabel} onPress={props.onPress} testID={`marker-z${props.zIndex}`}>
      {props.children}
    </Pressable>
  );
  return { __esModule: true, default: MapView, Marker, PROVIDER_DEFAULT: null, __methods: methods };
});

const { __methods: map } = jest.requireMock("react-native-maps") as { __methods: { fitToCoordinates: jest.Mock; animateToRegion: jest.Mock } };

const offers = [
  makeNearbyOffer("a", { title: "Шаурма", businessLat: 59.93, businessLng: 30.33, discountPercent: 40 }),
  makeNearbyOffer("b", { title: "Пицца", businessLat: 59.94, businessLng: 30.35, discountPercent: 60 }),
];

function surface(overrides: Partial<MapSurfaceProps> = {}) {
  const props: MapSurfaceProps = {
    center: { lat: 59.9343, lng: 30.3351 },
    userPosition: null,
    offers,
    selectedId: null,
    followSelection: false,
    onSelectOffer: jest.fn(),
    topInset: 90,
    bottomInset: 150,
    fitPoints: offers.map((offer) => ({ lat: offer.businessLat, lng: offer.businessLng })),
    fitKey: "k1",
    recenterKey: 0,
    ...overrides,
  };
  const tree = (p: MapSurfaceProps) => (
    <ThemeProvider>
      <NativeMapSurface {...p} />
    </ThemeProvider>
  );
  const view = render(tree(props));
  // Высота карты известна только после раскладки; в jest её нет — «раскладываем» вручную (700 px).
  fireEvent(view.getByTestId("native-map-surface"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } } });
  return { view, props, rerender: (next: Partial<MapSurfaceProps>) => view.rerender(tree({ ...props, ...next })) };
}

beforeEach(() => jest.clearAllMocks());

describe("NativeMapSurface", () => {
  it("draws a pin per offer and selects the offer whose pin was tapped", () => {
    const { view, props } = surface();
    expect(view.getAllByRole("button")).toHaveLength(2);
    fireEvent.press(view.getByRole("button", { name: /Пицца.*−60%/ }));
    expect(props.onSelectOffer).toHaveBeenCalledWith("b");
  });

  it("raises the selected pin above the others", () => {
    const { view } = surface({ selectedId: "a" });
    expect(view.getByTestId("marker-z1000")).toBeTruthy();
  });

  it("frames the first offers once, leaving room under the header and above the card rail", () => {
    const { rerender } = surface();
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(1);
    const [coordinates, options] = map.fitToCoordinates.mock.calls[0];
    expect(coordinates).toEqual([
      { latitude: 59.93, longitude: 30.33 },
      { latitude: 59.94, longitude: 30.35 },
    ]);
    expect(options.edgePadding.top).toBeGreaterThanOrEqual(90);
    expect(options.edgePadding.bottom).toBeGreaterThanOrEqual(150);
    // Тот же набор данных — не «дёргаем» камеру заново; новый набор — рамка заново.
    rerender({ selectedId: "a" });
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(1);
    rerender({ fitKey: "k2" });
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(2);
  });

  it("does not fly to a pin before the person has chosen something, and flies once they have", () => {
    const { rerender } = surface({ selectedId: "a", followSelection: false });
    expect(map.animateToRegion).not.toHaveBeenCalled();
    rerender({ selectedId: "b", followSelection: true });
    expect(map.animateToRegion).toHaveBeenCalledTimes(1);
    const [region] = map.animateToRegion.mock.calls[0];
    expect(region.longitude).toBe(30.35);
    // Центр съезжает так, чтобы пин оказался в видимой полосе между шапкой и лентой, а не под лентой.
    expect(region.latitude).toBeLessThan(59.94);
    expect(region.latitude).toBeCloseTo(centerLatForInset(59.94, region.latitudeDelta, 700, 150 - 90), 6);
  });

  it("returns to the person's position on request, and only when it is known", () => {
    const home = { lat: 59.95, lng: 30.3 };
    const { rerender } = surface({ userPosition: home });
    rerender({ recenterKey: 1 });
    expect(map.animateToRegion).toHaveBeenCalledTimes(1);
    expect(map.animateToRegion.mock.calls[0][0]).toMatchObject({ longitude: 30.3 });

    map.animateToRegion.mockClear();
    const unknown = surface({ userPosition: null });
    unknown.rerender({ recenterKey: 1 });
    expect(map.animateToRegion).not.toHaveBeenCalled();
  });
});
