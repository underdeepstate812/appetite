// Динамический конфиг поверх app.json: для веб-сборки на GitHub Pages приложение живёт не в корне домена (/appetite/mobile),
// поэтому базовый путь берётся из EXPO_BASE_URL. Без переменной конфиг совпадает с app.json.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments ?? {}),
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
