import type { YMaps3 } from "../types/ymaps3";

/**
 * Фейк Yandex Maps JS API 3.0 для тестов: повторяет форму API из официальной документации (конструкторы,
 * addChild/removeChild/update/destroy, YMapMarker(props, element), YMapListener с onClick(object, event)) и
 * записывает вызовы. Проверяет, что НАШ код пользуется API так, как описано; реальное поведение Яндекса
 * (тайлы, авторизация ключа) он, конечно, не проверяет.
 */
export class FakeEntity {
  constructor(
    public kind: string,
    public props: Record<string, unknown> = {},
    public element?: HTMLElement
  ) {}
  update(props: Record<string, unknown>) {
    this.props = { ...this.props, ...props };
  }
}

export class FakeMap {
  children: FakeEntity[] = [];
  updates: Record<string, unknown>[] = [];
  destroyed = false;
  constructor(
    public container: HTMLElement,
    public props: Record<string, unknown>
  ) {}
  addChild(child: FakeEntity) {
    this.children.push(child);
    return this;
  }
  removeChild(child: FakeEntity) {
    this.children = this.children.filter((c) => c !== child);
    return this;
  }
  update(props: Record<string, unknown>) {
    this.updates.push(props);
  }
  destroy() {
    this.destroyed = true;
  }
  byKind(kind: string) {
    return this.children.filter((c) => c.kind === kind);
  }
}

export function createFakeYmaps3() {
  const maps: FakeMap[] = [];
  const entity = (kind: string) =>
    class extends FakeEntity {
      constructor(props: Record<string, unknown> = {}, element?: HTMLElement) {
        super(kind, props, element);
      }
    };
  const api = {
    ready: Promise.resolve(),
    YMap: class extends FakeMap {
      constructor(container: HTMLElement, props: Record<string, unknown>) {
        super(container, props);
        maps.push(this);
      }
    },
    YMapDefaultSchemeLayer: entity("scheme"),
    YMapDefaultSatelliteLayer: entity("satellite"),
    YMapDefaultFeaturesLayer: entity("features"),
    YMapMarker: entity("marker"),
    YMapListener: entity("listener"),
    YMapControls: class extends FakeEntity {
      constructor(props: Record<string, unknown>) {
        super("controls", props);
      }
      addChild() {
        return this;
      }
    },
    import: async () => ({ YMapZoomControl: entity("zoom") }),
  } as unknown as YMaps3;
  return { api, maps };
}
