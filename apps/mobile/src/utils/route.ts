import { Platform } from "react-native";

/**
 * Ссылка «проложить маршрут» под платформу: iOS — приложение «Карты», Android — любое приложение с geo:-схемой,
 * иначе (веб) — OpenStreetMap. Название заведения кодируется, чтобы скобки и кавычки не ломали URL.
 */
export function routeUrl(lat: number, lng: number, name: string, os: string = Platform.OS): string {
  const label = encodeURIComponent(name);
  if (os === "ios") return `maps://?daddr=${lat},${lng}&q=${label}`;
  if (os === "android") return `geo:0,0?q=${lat},${lng}(${label})`;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
