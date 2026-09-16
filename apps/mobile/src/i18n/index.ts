import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import { DEFAULT_LOCALE } from "@apetite/shared";
import ru from "./locales/ru.json";
import en from "./locales/en.json";

const SUPPORTED_LOCALES = ["ru", "en"] as const;

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? DEFAULT_LOCALE;
const initialLocale = (SUPPORTED_LOCALES as readonly string[]).includes(deviceLocale)
  ? deviceLocale
  : DEFAULT_LOCALE;

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
});

export default i18n;
