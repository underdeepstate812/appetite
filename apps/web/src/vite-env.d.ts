/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_YANDEX_MAPS_API_KEY?: string;
  readonly VITE_APP_STORE_URL?: string;
  readonly VITE_GOOGLE_PLAY_URL?: string;
  readonly VITE_APP_DOWNLOAD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
