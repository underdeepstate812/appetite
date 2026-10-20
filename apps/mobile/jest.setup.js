// Мок-объект сам по себе ничего не подменяет — react-native-async-storage
// ожидает, что вызывающий проект зарегистрирует его через jest.mock (см. их
// официальную документацию по интеграции с Jest).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// В тестах шрифты не грузим: ThemeProvider иначе ждёт useFonts и ничего не рисует.
jest.mock("./src/theme/fonts", () => ({
  useDisplayFont: () => ({ ready: true, loaded: false }),
}));

// Нативная заставка в тестах не нужна: модуль только прячет её после первого кадра BootSplash.
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
