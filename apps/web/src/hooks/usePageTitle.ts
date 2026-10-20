import { useEffect } from "react";

/**
 * Заголовок вкладки для экрана. SPA не перезагружает страницу, поэтому без этого у всех маршрутов оставался
 * один <title> из index.html — скринридер и история браузера не различали страницы (WCAG 2.4.2).
 * При уходе с экрана прежний заголовок возвращается.
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
