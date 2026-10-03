/**
 * Иллюстрации к карточкам «Как это работает». Три инлайновых SVG в одном языке:
 * тёмная «ночная» подложка (как футер и карта в мокапе телефона), ember-оранжевый
 * для заведения и тил для пользователя/движения. Каждая сцена — один сюжет шага:
 *   1. карта города с маршрутом и меткой заведения русской кухни,
 *   2. перевод «банк → банк» за заказ,
 *   3. готовый заказ и QR для выдачи.
 * Цифра шага (01/02/03) нарисована в самом SVG контуром — масштабируется вместе с картинкой.
 * Анимации — CSS (см. .sc-* в global.css), стартуют, когда карточка получает .is-visible,
 * и полностью отключаются при prefers-reduced-motion (финальное состояние остаётся на экране).
 */

const EMBER_FROM = "#ff8a3d";
const EMBER_TO = "#e2541a";
const TEAL = "#2dd4bf";
const CREAM = "#fffdf9";

export type StepSceneKind = "map" | "pay" | "pickup";

interface Props {
  kind: StepSceneKind;
  index: number;
  label: string;
}

export function StepScene({ kind, index, label }: Props) {
  return (
    <svg
      className="sc-svg"
      viewBox="0 0 360 176"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {kind === "map" ? <MapScene /> : kind === "pay" ? <PayScene /> : <PickupScene />}
      <text className="sc-num" x="16" y="54" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </text>
    </svg>
  );
}

/**
 * Борщ сверху: тарелка с гжельским ободком, свекольный бульон, сметана и укроп — русское блюдо, которое
 * читается даже в 20px. Центр (0,0), радиус ≈ 11.
 */
function Dish({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r="11" fill="#fffdf9" stroke="#2b5bb8" strokeWidth="1.4" />
      <circle r="9.3" fill="none" stroke="#2b5bb8" strokeWidth="0.7" strokeDasharray="1.6 1.4" />
      <circle r="7.6" fill="#a81f25" />
      <circle cx="-2.4" cy="-2.6" r="3.4" fill="#c4323a" opacity="0.55" />
      <circle cx="0.6" cy="0.4" r="3.1" fill="#fff4e3" />
      <path d="M-1.6 0.6 Q0.4 -1.4 2.2 0.4" fill="none" stroke="#e3d2b4" strokeWidth="0.8" strokeLinecap="round" />
      <g stroke="#3f9b4a" strokeWidth="1" strokeLinecap="round">
        <path d="M2.6 -2.4 L4.6 -4.4" />
        <path d="M3.4 -1.2 L5.8 -2.2" />
        <path d="M-3.6 3.2 L-5.4 4.6" />
      </g>
    </g>
  );
}

function MapScene() {
  return (
    <>
      <defs>
        <linearGradient id="sc1-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b1812" />
          <stop offset="1" stopColor="#110f0b" />
        </linearGradient>
        <radialGradient id="sc1-glow" cx="0.67" cy="0.4" r="0.5">
          <stop offset="0" stopColor={EMBER_FROM} stopOpacity="0.28" />
          <stop offset="1" stopColor={EMBER_FROM} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sc1-pin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={EMBER_FROM} />
          <stop offset="1" stopColor={EMBER_TO} />
        </linearGradient>
      </defs>
      <rect width="360" height="176" fill="url(#sc1-bg)" />
      {/* кварталы, парк и река */}
      <g fill="#201c15">
        <rect x="150" y="12" width="52" height="30" rx="4" />
        <rect x="292" y="104" width="52" height="40" rx="4" />
        <rect x="26" y="96" width="40" height="34" rx="4" />
        <rect x="196" y="128" width="64" height="30" rx="4" />
        <rect x="110" y="132" width="44" height="30" rx="4" />
        <rect x="300" y="14" width="46" height="26" rx="4" />
      </g>
      <rect x="222" y="14" width="50" height="34" rx="6" fill="#10271f" />
      <path d="M-10 168 C60 150 110 176 190 160 S320 150 380 168" fill="none" stroke="#12302d" strokeWidth="14" strokeLinecap="round" />
      {/* улицы */}
      <g fill="none" stroke="#2c261d" strokeLinecap="round">
        <path d="M-10 118 L120 84 L240 104 L380 52" strokeWidth="7" />
        <path d="M70 -10 L110 190" strokeWidth="5" />
        <path d="M206 -10 L190 190" strokeWidth="5" />
        <path d="M290 -10 L316 190" strokeWidth="3.5" />
        <path d="M-10 60 L120 40 L380 112" strokeWidth="3.5" />
        <path d="M130 100 L150 190" strokeWidth="3" />
      </g>
      <rect width="360" height="176" fill="url(#sc1-glow)" />
      {/* второстепенные заведения */}
      <circle cx="140" cy="50" r="4" fill={EMBER_FROM} opacity="0.5" />
      <circle cx="40" cy="78" r="3.5" fill={TEAL} opacity="0.45" />
      <circle cx="316" cy="124" r="4" fill={EMBER_FROM} opacity="0.5" />
      <circle cx="246" cy="146" r="3.5" fill={TEAL} opacity="0.45" />
      {/* маршрут от пользователя к заведению */}
      <path
        className="sc-route"
        d="M96 136 C132 136 140 104 176 100 S218 86 240 80"
        fill="none"
        stroke={TEAL}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 9"
      />
      {/* пользователь */}
      <circle className="sc-pulse sc-pulse-teal" cx="96" cy="136" r="9" fill={TEAL} opacity="0.35" />
      <circle cx="96" cy="136" r="5.5" fill={TEAL} stroke={CREAM} strokeWidth="2" />
      {/* метка заведения (борщ) */}
      <g transform="translate(240 80)">
        <ellipse className="sc-pulse sc-pulse-ember" cx="0" cy="0" rx="14" ry="5" fill={EMBER_FROM} opacity="0.5" />
        <ellipse cx="0" cy="0" rx="5" ry="2" fill="#000" opacity="0.4" />
        <g className="sc-pin">
          <path
            d="M0 0 C-10 -12 -19 -22 -19 -34 A19 19 0 0 1 19 -34 C19 -22 10 -12 0 0 Z"
            fill="url(#sc1-pin)"
            stroke={CREAM}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="-34" r="13" fill="#fff4e3" />
          <Dish x={0} y={-34} />
        </g>
      </g>
      <g className="sc-chip">
        <rect x="262" y="34" width="80" height="24" rx="7" fill={CREAM} />
        <text x="302" y="50" textAnchor="middle" className="sc-chip-text">
          Борщ −40%
        </text>
      </g>
    </>
  );
}

function PayScene() {
  return (
    <>
      <defs>
        <linearGradient id="sc2-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14201e" />
          <stop offset="1" stopColor="#100e0b" />
        </linearGradient>
        <linearGradient id="sc2-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14a396" />
          <stop offset="1" stopColor="#0b5a54" />
        </linearGradient>
        <linearGradient id="sc2-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={EMBER_FROM} />
          <stop offset="1" stopColor={EMBER_TO} />
        </linearGradient>
        <pattern id="sc2-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="#fffdf9" opacity="0.09" />
        </pattern>
        <radialGradient id="sc2-glow" cx="0.5" cy="0.62" r="0.45">
          <stop offset="0" stopColor={TEAL} stopOpacity="0.2" />
          <stop offset="1" stopColor={TEAL} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="360" height="176" fill="url(#sc2-bg)" />
      <rect width="360" height="176" fill="url(#sc2-dots)" />
      <rect width="360" height="176" fill="url(#sc2-glow)" />
      {/* линия перевода и «пакеты» денег */}
      <line x1="124" y1="112" x2="236" y2="112" stroke={CREAM} strokeOpacity="0.22" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
      <g className="sc-packets">
        <circle className="sc-packet" cx="124" cy="112" r="4.5" fill={TEAL} style={{ animationDelay: "0s" }} />
        <circle className="sc-packet" cx="124" cy="112" r="4.5" fill={TEAL} style={{ animationDelay: "0.55s" }} />
        <circle className="sc-packet" cx="124" cy="112" r="4.5" fill={TEAL} style={{ animationDelay: "1.1s" }} />
      </g>
      {/* карта «Ваш банк» */}
      <g className="sc-card sc-card-a">
        <rect x="20" y="78" width="104" height="68" rx="11" fill="url(#sc2-a)" />
        <rect x="20.5" y="78.5" width="103" height="67" rx="10.5" fill="none" stroke={CREAM} strokeOpacity="0.28" />
        <text x="32" y="94" className="sc-card-label">Ваш банк</text>
        <rect x="32" y="102" width="18" height="13" rx="3" fill="#f5d27a" />
        <path d="M32 108.5 H50 M41 102 V115" stroke="#b58a2a" strokeWidth="0.8" />
        <text x="32" y="134" className="sc-card-digits">•••• 4821</text>
      </g>
      {/* карта «Банк заведения» */}
      <g className="sc-card sc-card-b">
        <rect x="236" y="78" width="104" height="68" rx="11" fill="url(#sc2-b)" />
        <rect x="236.5" y="78.5" width="103" height="67" rx="10.5" fill="none" stroke={CREAM} strokeOpacity="0.32" />
        <text x="248" y="94" className="sc-card-label">Банк заведения</text>
        <rect x="248" y="102" width="18" height="13" rx="3" fill="#f5d27a" />
        <path d="M248 108.5 H266 M257 102 V115" stroke="#b58a2a" strokeWidth="0.8" />
        <text x="248" y="134" className="sc-card-digits">•••• 0917</text>
      </g>
      {/* сумма и подтверждение */}
      <g className="sc-chip">
        <rect x="150" y="40" width="60" height="24" rx="7" fill={CREAM} />
        <text x="180" y="56" textAnchor="middle" className="sc-chip-text">420 ₽</text>
      </g>
      <line x1="180" y1="64" x2="180" y2="94" stroke={CREAM} strokeOpacity="0.22" strokeWidth="1.5" strokeDasharray="2 4" />
      <circle className="sc-pulse sc-pulse-teal" cx="180" cy="112" r="17" fill={TEAL} opacity="0.35" />
      <circle cx="180" cy="112" r="16" fill={CREAM} />
      <path className="sc-check" d="M172 112.5 L178 118.5 L189 106" fill="none" stroke="#0f766e" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

const QR = ["111010111", "101101101", "111010111", "010110010", "101001101", "011100110", "111011010", "101110101", "111001110"];

function PickupScene() {
  return (
    <>
      <defs>
        <linearGradient id="sc3-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d1810" />
          <stop offset="1" stopColor="#100e0a" />
        </linearGradient>
        <radialGradient id="sc3-glow" cx="0.34" cy="0.55" r="0.42">
          <stop offset="0" stopColor={EMBER_FROM} stopOpacity="0.3" />
          <stop offset="1" stopColor={EMBER_FROM} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sc3-bag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9b27a" />
          <stop offset="0.5" stopColor="#ecc98f" />
          <stop offset="1" stopColor="#cfa467" />
        </linearGradient>
        <clipPath id="sc3-qr-clip">
          <rect x="230" y="58" width="70" height="70" rx="8" />
        </clipPath>
        <linearGradient id="sc3-scan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={TEAL} stopOpacity="0" />
          <stop offset="1" stopColor={TEAL} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="360" height="176" fill="url(#sc3-bg)" />
      <rect width="360" height="176" fill="url(#sc3-glow)" />
      {/* прилавок */}
      <rect x="0" y="146" width="360" height="30" fill="#241f16" />
      <rect x="0" y="146" width="360" height="2" fill={CREAM} opacity="0.12" />
      {/* пар */}
      <g fill="none" stroke={CREAM} strokeWidth="2.4" strokeLinecap="round" opacity="0.5">
        <path className="sc-steam" style={{ animationDelay: "0s" }} d="M118 66 C112 58 124 52 118 44" />
        <path className="sc-steam" style={{ animationDelay: "0.5s" }} d="M136 64 C130 56 142 50 136 40" />
        <path className="sc-steam" style={{ animationDelay: "1s" }} d="M154 66 C148 58 160 52 154 44" />
      </g>
      {/* пакет */}
      <g className="sc-bag">
        <ellipse cx="136" cy="148" rx="46" ry="5" fill="#000" opacity="0.4" />
        <path d="M112 78 C112 54 160 54 160 78" fill="none" stroke="#b88c52" strokeWidth="3" strokeLinecap="round" />
        <path d="M92 78 H180 L174 148 H98 Z" fill="url(#sc3-bag)" />
        <path d="M92 78 H180 L179 86 H93 Z" fill="#000" opacity="0.1" />
        <path d="M136 78 V148" stroke="#000" strokeOpacity="0.07" strokeWidth="1" />
        <circle cx="136" cy="114" r="17" fill="#fff4e3" />
        <Dish x={136} y={114} s={1.25} />
      </g>
      {/* QR для выдачи */}
      <g className="sc-qr">
        <rect x="224" y="52" width="82" height="82" rx="11" fill={CREAM} />
        <g clipPath="url(#sc3-qr-clip)">
          <g transform="translate(236 64)" fill="#12100d">
            {QR.flatMap((row, r) =>
              row.split("").map((cell, c) =>
                cell === "1" ? <rect key={`${r}-${c}`} x={c * 6.4} y={r * 6.4} width="5.6" height="5.6" rx="1.2" /> : null
              )
            )}
          </g>
          <rect className="sc-scan" x="230" y="58" width="70" height="26" fill="url(#sc3-scan)" />
        </g>
        <g fill="none" stroke={EMBER_FROM} strokeWidth="3" strokeLinecap="round">
          <path d="M218 66 V58 Q218 46 230 46 H238" />
          <path d="M312 66 V58 Q312 46 300 46 H292" />
          <path d="M218 120 V128 Q218 140 230 140 H238" />
          <path d="M312 120 V128 Q312 140 300 140 H292" />
        </g>
      </g>
      {/* статус */}
      <g className="sc-chip">
        <rect x="206" y="150" width="118" height="20" rx="10" fill={TEAL} />
        <path d="M218 160.5 L222 164.5 L229 156" fill="none" stroke="#0b3f3a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="237" y="164" className="sc-status-text">Заказ готов</text>
      </g>
    </>
  );
}
