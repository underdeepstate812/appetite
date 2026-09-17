import { useEffect, useRef, useState } from "react";

/**
 * Мягкое световое пятно, следующее за курсором — только для десктопа с точным
 * указателем (matchMedia "pointer: fine"), полностью выключено на тач-устройствах
 * и при prefers-reduced-motion (см. также @media (hover: none) в global.css как
 * CSS-подстраховку на случай гибридных устройств).
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEnabled(fine && !reduced);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    const onMove = (event: MouseEvent) => {
      node.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      node.style.opacity = "1";
    };
    const onLeave = () => {
      node.style.opacity = "0";
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return <div ref={ref} className="cursor-glow" style={{ opacity: 0 }} aria-hidden="true" />;
}
