import { registerRootComponent } from 'expo';

import App from './App';

// Демо-режим (EXPO_PUBLIC_DEMO=1, веб-сборка для GitHub Pages): API обслуживает встроенный backend из @apetite/demo,
// сервер не нужен. Подмена fetch ставится до старта приложения; в обычной сборке условие ложно и блок вырезается.
if (process.env.EXPO_PUBLIC_DEMO === '1') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { installDemoApi } = require('@apetite/demo') as typeof import('@apetite/demo');
  installDemoApi({
    apiBase: process.env.EXPO_PUBLIC_API_BASE_URL as string,
    assetBase: new URL(`${process.env.EXPO_PUBLIC_BASE_PATH ?? ''}/demo/`, window.location.href).href,
    banner: {
      app: 'мобильная версия',
      lines: [
        'Это демо: данные примерные, сервер не нужен — всё хранится в вашем браузере.',
        'Вход: <b>user@apetite.ru</b> / <b>password123</b> (или зарегистрируйтесь).',
        'Лучше смотреть в узком окне или в режиме телефона.',
      ],
    },
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
