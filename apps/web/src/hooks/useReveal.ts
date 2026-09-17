import { useEffect, useRef } from "react";

/**
 * Простая scroll-reveal анимация через IntersectionObserver — элемент получает
 * класс "is-visible" (см. .reveal в global.css) один раз, когда впервые входит
 * в вьюпорт. Только opacity/transform в CSS — дёшево, не блокирует скролл.
 *
 * Опциональный onReveal вызывается в тот же момент — используется, например,
 * чтобы запустить count-up анимацию цифр синхронно с появлением блока
 * (см. LandingPage: useCountUp триггерится через этот колбэк, а не отдельным
 * IntersectionObserver, чтобы не плодить наблюдателей на одну и ту же секцию).
 */
export function useReveal<T extends HTMLElement>(onReveal?: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add("is-visible");
          onReveal?.();
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
