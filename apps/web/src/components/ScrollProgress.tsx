import { useEffect, useState } from "react";

/**
 * Тонкая градиентная полоса вверху страницы, растущая с прогрессом скролла —
 * заодно даёт лёгкую пространственную привязку на длинном лендинге, а не только
 * декоративный эффект.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(scrollTop / max, 1) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="scroll-progress"
      style={{ width: "100%", transform: `scaleX(${progress})` }}
      aria-hidden="true"
    />
  );
}
