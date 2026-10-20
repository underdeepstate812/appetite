/**
 * Охрана от возврата статического import: экран тестового показа не должен попадать в production-бандл.
 * Проверяем поведение — при `__DEV__ = false` модуль экрана не загружается ни из devScreens, ни из навигаторов.
 */
const globals = globalThis as { __DEV__?: boolean };
const original = globals.__DEV__;

afterEach(() => {
  globals.__DEV__ = original;
  jest.resetModules();
});

// Всё, что навигаторы подтягивают помимо проверяемого (экраны, карты и прочий нативный код), подменяем пустышками.
const STUBBED = [
  "./MainTabNavigator",
  "../screens/auth/LoginScreen",
  "../screens/auth/RegisterScreen",
  "../screens/offer-detail/OfferDetailScreen",
  "../screens/checkout/CheckoutScreen",
  "../screens/order-confirmation/OrderConfirmationScreen",
  "../screens/order-detail/OrderDetailScreen",
  "../screens/notifications/NotificationsScreen",
];

function loadWithDev(dev: boolean, modules: string[]) {
  const loaded = jest.fn();
  for (const path of STUBBED) jest.doMock(path, () => new Proxy({}, { get: () => () => null }));
  jest.doMock("../screens/lab/UiLabScreen", () => {
    loaded();
    return { UiLabScreen: () => null };
  });
  globals.__DEV__ = dev;
  const exported: Record<string, unknown>[] = [];
  jest.isolateModules(() => {
    for (const path of modules) exported.push(require(path));
  });
  jest.dontMock("../screens/lab/UiLabScreen");
  for (const path of STUBBED) jest.dontMock(path);
  return { loaded, exported };
}

describe("dev-only lab screen", () => {
  it("is not loaded in production: devScreens exposes null and never touches the module", () => {
    const { loaded, exported } = loadWithDev(false, ["./devScreens"]);
    expect(exported[0].UiLabScreen).toBeNull();
    expect(loaded).not.toHaveBeenCalled();
  });

  it("is not loaded in production through the navigators either (no static import slipped back in)", () => {
    const { loaded } = loadWithDev(false, ["./RootNavigator", "./AuthNavigator"]);
    expect(loaded).not.toHaveBeenCalled();
  });

  it("is available in development", () => {
    const { loaded, exported } = loadWithDev(true, ["./devScreens"]);
    expect(exported[0].UiLabScreen).toEqual(expect.any(Function));
    expect(loaded).toHaveBeenCalledTimes(1);
  });
});
