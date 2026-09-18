/**
 * Тот же фирменный знак, что в apps/web и apps/mobile — "жидкая капля-пин с
 * укусом" (карта — ядро продукта, вырез сбоку — аппетит/укус). Единая
 * визуальная идентичность на всех поверхностях, включая внутренний инструмент.
 */
export function AppetiteMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="apetiteMarkGradAdmin" x1="8" y1="3" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-primary-dark)" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        d="M24 3 C34 2 41 10 39 20 C38 27 33 33 26 40 C24.5 42 23 42 21 39 C14 31 8 25 9 17 C10 8 16 4 24 3 Z M39 13 A6 6 0 1 0 27 13 A6 6 0 1 0 39 13 Z"
        fill="url(#apetiteMarkGradAdmin)"
      />
      <circle cx="16" cy="14" r="2.5" fill="#FFFFFF" opacity={0.55} />
    </svg>
  );
}
