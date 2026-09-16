import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE } from "@apetite/shared";
import ru from "./locales/ru.json";
import en from "./locales/en.json";

export const SUPPORTED_LOCALES = ["ru", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// RU — основной язык беты (ШАГ 0), не просто фолбэк на неподдерживаемую локаль:
// приложение всегда стартует на русском независимо от локали устройства.
// Явный выбор языка — через переключатель в Profile (languageStore), не автоопределение.
void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
});

export default i18n;
