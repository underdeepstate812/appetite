/**
 * Стилизованный макет телефона с открытой картой предложений и маркерами скидок —
 * повторяет реальный визуальный язык мобильного приложения (LeafletMapView,
 * apps/mobile/src/components/LeafletMapView.tsx: те же пилюли "-N%"), перекрашен
 * под новую "liquid glass" палитру сайта (лайм + лавандовый на тёмном).
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
          <stop offset="0%" stopColor="#141c14" />
          <stop offset="100%" stopColor="#0d130e" />
        </linearGradient>
        <linearGradient id="pinGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#caff4d" />
          <stop offset="100%" stopColor="#a8e62e" />
        </linearGradient>
        <filter id="phoneShadow" x="-40%" y="-20%" width="180%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="28" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Корпус телефона */}
      <rect x="4" y="4" width="292" height="612" rx="44" fill="#0a0f0b" filter="url(#phoneShadow)" />
      <rect x="10" y="10" width="280" height="600" rx="40" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
      <rect x="12" y="12" width="276" height="596" rx="36" fill="#10160f" />
      {/* Динамик/камера */}
      <rect x="118" y="26" width="64" height="18" rx="9" fill="#000000" />

      {/* Экран */}
      <clipPath id="screenClip">
        <rect x="20" y="56" width="260" height="500" rx="20" />
      </clipPath>
      <g clipPath="url(#screenClip)">
        <rect x="20" y="56" width="260" height="500" fill="url(#screenGlow)" />

        {/* Хедер приложения */}
        <text x="36" y="94" fontFamily="'Unbounded', sans-serif" fontSize="18" fontWeight="700" fill="#caff4d">
          Apetite
        </text>
        <circle cx="256" cy="88" r="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
        <path d="M251 92 a5 6 0 0 1 10 0 z" fill="#b7a6ff" />

        {/* Условные дороги на карте */}
        <path d="M-10 220 C 80 180, 160 260, 310 210" stroke="rgba(255,255,255,0.09)" strokeWidth="10" fill="none" />
        <path d="M-10 340 C 90 300, 150 420, 310 360" stroke="rgba(255,255,255,0.09)" strokeWidth="10" fill="none" />
        <path d="M60 100 C 40 220, 120 320, 90 500" stroke="rgba(255,255,255,0.07)" strokeWidth="8" fill="none" />
        <path d="M220 110 C 240 230, 190 340, 230 520" stroke="rgba(255,255,255,0.07)" strokeWidth="8" fill="none" />
        <circle cx="150" cy="300" r="70" fill="rgba(183,166,255,0.08)" />

        {/* Пин-маркеры со скидками — та же форма, что в LeafletMapView */}
        {[
          { x: 90, y: 190, label: "−70%" },
          { x: 190, y: 240, label: "−50%" },
          { x: 130, y: 340, label: "−60%" },
          { x: 210, y: 400, label: "−50%" },
        ].map((pin, index) => (
          <g key={`${pin.label}-${index}`} transform={`translate(${pin.x} ${pin.y})`}>
            <rect
              x="-26"
              y="-14"
              width="52"
              height="28"
              rx="14"
              fill="url(#pinGradient)"
              stroke="#0a0f0b"
              strokeWidth="2"
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              fontFamily="'Onest', sans-serif"
              fontSize="12"
              fontWeight="700"
              fill="#0a0f0b"
            >
              {pin.label}
            </text>
          </g>
        ))}

        {/* Нижняя карточка оффера */}
        <rect x="20" y="470" width="220" height="70" rx="16" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.12)" />
        <text x="36" y="497" fontFamily="'Onest', sans-serif" fontSize="13" fontWeight="700" fill="#f4f7ee">
          Набор десертов дня
        </text>
        <text x="36" y="517" fontFamily="'Onest', sans-serif" fontSize="12" fill="#9aa596">
          180 ₽ вместо 600 ₽ · 0.4 км
        </text>
      </g>

      {/* Обводка экрана поверх контента */}
      <rect x="20" y="56" width="260" height="500" rx="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    </svg>
  );
}
