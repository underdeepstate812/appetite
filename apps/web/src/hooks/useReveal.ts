import { useEffect, useRef } from "react";

/**
 * Простая scroll-reveal анимация через IntersectionObserver — элемент получает
 * класс "is-visible" (см. .reveal в global.css) один раз, когда впервые входит
 * в вьюпорт. Только opacity/transform в CSS — дёшево, не блокирует скролл.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
}
