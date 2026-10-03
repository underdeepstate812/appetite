import { useFonts } from "expo-font";
// Импорт из подпути конкретного веса: корневой индекс пакета подтягивает ВСЕ начертания (~9 TTF по 400 КБ) в бандл.
import { Unbounded_700Bold } from "@expo-google-fonts/unbounded/700Bold";

/**
 * Загрузка display-гарнитуры. `ready` — можно рисовать (загрузилось или окончательно не
 * удалось: тогда работаем на системных шрифтах, а не висим на заставке), `loaded` — Unbounded
 * реально доступен, и тема может ссылаться на его файл.
 */
export function useDisplayFont(): { ready: boolean; loaded: boolean } {
  const [loaded, error] = useFonts({ Unbounded_700Bold });
  return { ready: loaded || !!error, loaded };
}
