import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { SUPPORTED_LOCALES, type SupportedLocale } from "../i18n";
import { DEFAULT_LOCALE } from "@apetite/shared";

const STORAGE_KEY = "apetite.locale";

interface LanguageState {
  locale: SupportedLocale;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: SupportedLocale) => Promise<void>;
}

// RU — жёсткий дефолт при старте (см. src/i18n/index.ts); это только применяет
// явный выбор пользователя поверх него, если он был сохранён в прошлый раз.
export const useLanguageStore = create<LanguageState>()((set) => ({
  locale: DEFAULT_LOCALE as SupportedLocale,
  isHydrated: false,

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
        await i18n.changeLanguage(stored);
        set({ locale: stored as SupportedLocale, isHydrated: true });
        return;
      }
    } catch {
      // AsyncStorage недоступен — остаёмся на дефолтном RU.
    }
    set({ isHydrated: true });
  },

  setLocale: async (locale) => {
    await i18n.changeLanguage(locale);
    set({ locale });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // best-effort — переживёт только текущую сессию, не критично
    }
  },
}));
