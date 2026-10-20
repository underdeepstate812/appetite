/**
 * Минимальные типы Yandex Maps JS API 3.0 — ровно то, чем пользуется YandexOffersMap. Описаны по официальной
 * документации (yandex.ru/maps-api/docs/js-api); полный пакет типов не тянем ради нескольких классов.
 * ВАЖНО: порядок координат в API v3 — [долгота, широта] (у Leaflet — наоборот).
 */
export type LngLat = [number, number];

export interface YLocationRequest {
  center?: LngLat;
  bounds?: [LngLat, LngLat];
  zoom?: number;
  duration?: number;
}

export interface YMapInstance {
  addChild(child: unknown): YMapInstance;
  removeChild(child: unknown): YMapInstance;
  update(props: { location?: YLocationRequest; margin?: [number, number, number, number] }): void;
  destroy(): void;
}

export interface YMarkerProps {
  coordinates: LngLat;
  zIndex?: number;
  onClick?: () => void;
}

export interface YMarkerInstance {
  update(props: Partial<YMarkerProps>): void;
}

export interface YMaps3 {
  ready: Promise<void>;
  YMap: new (
    container: HTMLElement,
    props: { location: { center: LngLat; zoom: number }; margin?: [number, number, number, number] }
  ) => YMapInstance;
  YMapDefaultSchemeLayer: new (props?: object) => unknown;
  YMapDefaultSatelliteLayer: new (props?: object) => unknown;
  YMapDefaultFeaturesLayer: new (props?: object) => unknown;
  YMapMarker: new (props: YMarkerProps, element?: HTMLElement) => YMarkerInstance;
  YMapListener: new (props: {
    layer?: string;
    onClick?: (object: unknown, event: unknown) => void;
    /** Вызывается при любом движении/зуме карты; location.zoom — текущий зум. */
    onUpdate?: (event: { location: { zoom: number } }) => void;
  }) => unknown;
  YMapControls: new (props: { position: string }) => { addChild(child: unknown): unknown };
  import: (moduleName: string) => Promise<Record<string, new (props?: object) => unknown>>;
}

declare global {
  interface Window {
    ymaps3?: YMaps3;
  }
}
