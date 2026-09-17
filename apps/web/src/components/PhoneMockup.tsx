/**
 * Стилизованный макет телефона с открытой картой предложений и маркерами скидок —
 * повторяет реальный визуальный язык мобильного приложения (LeafletMapView,
 * apps/mobile/src/components/LeafletMapView.tsx: те же оранжевые пилюли "-N%"),
 * не абстрактная картинка "какой-то телефон с каким-то экраном".
 */
export function PhoneMockup() {
  return (
    <svg
      viewBox="0 0 300 620"
      width="100%"
      role="img"
      aria-label="Экран приложения Apetite с картой предложений и маркерами скидок рядом"
    >
      <defs>
        <linearGradient id="screenGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="100%" stopColor="#ffe8d1" />
        </linearGradient>
        <filter id="phoneShadow" x="-40%" y="-20%" width="180%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="24" floodColor="#ea580c" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Корпус телефона */}
      <rect x="4" y="4" width="292" height="612" rx="44" fill="#1a1a1a" filter="url(#phoneShadow)" />
      <rect x="12" y="12" width="276" height="596" rx="36" fill="#ffffff" />
      {/* Динамик/камера */}
      <rect x="118" y="26" width="64" height="18" rx="9" fill="#1a1a1a" />

      {/* Экран */}
      <clipPath id="screenClip">
        <rect x="20" y="56" width="260" height="500" rx="20" />
      </clipPath>
      <g clipPath="url(#screenClip)">
        <rect x="20" y="56" width="260" height="500" fill="url(#screenGlow)" />

        {/* Хедер приложения */}
        <text x="36" y="94" fontFamily="system-ui, sans-serif" fontSize="20" fontWeight="800" fill="#ea580c">
          Apetite
        </text>
        <circle cx="256" cy="88" r="14" fill="#ffffff" opacity="0.8" />
        <path d="M251 92 a5 6 0 0 1 10 0 z" fill="#ea580c" />

        {/* Условные дороги на карте */}
        <path d="M-10 220 C 80 180, 160 260, 310 210" stroke="#fbd9a5" strokeWidth="10" fill="none" />
        <path d="M-10 340 C 90 300, 150 420, 310 360" stroke="#fbd9a5" strokeWidth="10" fill="none" />
        <path d="M60 100 C 40 220, 120 320, 90 500" stroke="#fbd9a5" strokeWidth="8" fill="none" />
        <path d="M220 110 C 240 230, 190 340, 230 520" stroke="#fbd9a5" strokeWidth="8" fill="none" />
        <circle cx="150" cy="300" r="70" fill="#fdebd3" opacity="0.6" />

        {/* Пин-маркеры со скидками — та же форма, что в LeafletMapView */}
        {[
          { x: 90, y: 190, label: "−70%" },
          { x: 190, y: 240, label: "−50%" },
          { x: 130, y: 340, label: "−60%" },
          { x: 210, y: 400, label: "−50%" },
        ].map((pin, index) => (
          <g key={`${pin.label}-${index}`} transform={`translate(${pin.x} ${pin.y})`}>
            <rect x="-26" y="-14" width="52" height="28" rx="14" fill="#ea580c" stroke="#ffffff" strokeWidth="2.5" />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize="12"
              fontWeight="700"
              fill="#ffffff"
            >
              {pin.label}
            </text>
          </g>
        ))}

        {/* Нижняя карточка оффера */}
        <rect x="20" y="470" width="220" height="70" rx="16" fill="#ffffff" opacity="0.95" />
        <text x="36" y="497" fontFamily="system-ui, sans-serif" fontSize="13" fontWeight="700" fill="#1a1a1a">
          Набор десертов дня
        </text>
        <text x="36" y="517" fontFamily="system-ui, sans-serif" fontSize="12" fill="#6b6b6b">
          180 ₽ вместо 600 ₽ · 0.4 км
        </text>

        {/* Таб-бар */}
        <rect x="20" y="516" width="260" height="40" fill="#ffffff" opacity="0" />
      </g>

      {/* Обводка экрана поверх контента */}
      <rect x="20" y="56" width="260" height="500" rx="20" fill="none" stroke="#f2f2f2" strokeWidth="1" />
    </svg>
  );
}
