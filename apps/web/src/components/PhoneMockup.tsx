import { useEffect, useState, type CSSProperties } from "react";
import type { NearbyOffer } from "@apetite/shared";
import { offersApi } from "../api/offers";

/** Питер целиком — мокап не привязан к конкретной геопозиции посетителя. */
const SPB_CENTER = { lat: 59.9311, lng: 30.3609 };
const RADIUS_KM = 20;
const PIN_COUNT = 4;
/** Порог "горящей" скидки — тот же, что и в ленте предложений (OffersRibbon). */
const HOT_DISCOUNT_THRESHOLD = 60;

const PIN_POSITIONS = [
  { x: 78, y: 128 },
  { x: 168, y: 96 },
  { x: 60, y: 248 },
  { x: 190, y: 232 },
];

/**
 * Взвешенная выборка без повторов: офферы со скидкой 50%+ примерно в 4 раза
 * вероятнее попадут в отобранные N, чем более скромные — карта должна в первую
 * очередь хвастаться самым горячим, а не быть равномерным срезом витрины.
 */
function weightedSample(offers: NearbyOffer[], count: number): NearbyOffer[] {
  const pool = [...offers];
  const picked: NearbyOffer[] = [];

  while (picked.length < count && pool.length > 0) {
    const weights = pool.map((offer) => (offer.discountPercent >= 50 ? 4 : 1));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    let index = 0;
    for (; index < weights.length - 1; index++) {
      roll -= weights[index];
      if (roll <= 0) break;
    }
    picked.push(pool[index]);
    pool.splice(index, 1);
  }

  return picked;
}

/**
 * Макет телефона с картой предложений — пины и карточки нижней панели теперь
 * реальные активные офферы (GET /offers/nearby), не выдуманные строки. Выборка
 * рандомная при каждой загрузке страницы, но взвешена в пользу скидок 50%+
 * (см. weightedSample). Позиции пинов на карте — фиксированный стилизованный
 * макет (это иллюстрация экрана, не настоящая проекция координат), но их
 * содержимое — честные данные с backend.
 */
export function PhoneMockup() {
  const [expanded, setExpanded] = useState(false);
  const [offers, setOffers] = useState<NearbyOffer[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    offersApi
      .nearby({ ...SPB_CENTER, radiusKm: RADIUS_KM })
      .then((data) => {
        if (!cancelled) setOffers(weightedSample(data, PIN_COUNT));
      })
      .catch(() => {
        // Витрина недоступна (backend не поднят и т.п.) — тихо остаёмся с пустой
        // картой, это декоративный мокап на лендинге, а не рабочий экран.
        if (!cancelled) setOffers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hotOffer = offers?.reduce<NearbyOffer | null>(
    (hottest, offer) => (!hottest || offer.discountPercent > hottest.discountPercent ? offer : hottest),
    null
  );

  return (
    <div style={frameStyle}>
      {/* Боковые кнопки — на корпусе, не на экране, поэтому висят вне screenStyle. */}
      <div style={{ ...sideButtonStyle, left: -2, top: 96, height: 28 }} />
      <div style={{ ...sideButtonStyle, left: -2, top: 136, height: 46 }} />
      <div style={{ ...sideButtonStyle, left: -2, top: 192, height: 46 }} />
      <div style={{ ...sideButtonStyle, right: -2, top: 148, height: 64 }} />

      <div style={islandStyle}>
        <div style={cameraDotStyle} />
      </div>

      <div style={screenStyle}>
        {/* карта — стилизованный СПб: Нева, набережные, кварталы, парк */}
        <svg viewBox="0 0 260 460" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <rect width="260" height="460" fill="var(--color-surface)" />

          {/* городские кварталы — лёгкая текстура застройки под улицами */}
          <g fill="var(--color-border)" opacity="0.5">
            <rect x="14" y="30" width="34" height="26" rx="3" />
            <rect x="56" y="24" width="22" height="40" rx="3" />
            <rect x="100" y="34" width="30" height="22" rx="3" />
            <rect x="146" y="26" width="26" height="30" rx="3" />
            <rect x="20" y="160" width="26" height="34" rx="3" />
            <rect x="150" y="150" width="32" height="24" rx="3" />
            <rect x="196" y="180" width="24" height="30" rx="3" />
            <rect x="18" y="290" width="30" height="24" rx="3" />
            <rect x="90" y="310" width="26" height="30" rx="3" />
            <rect x="170" y="300" width="28" height="22" rx="3" />
            <rect x="200" y="360" width="26" height="30" rx="3" />
            <rect x="60" y="380" width="30" height="24" rx="3" />
          </g>

          {/* парк */}
          <ellipse cx="205" cy="90" rx="38" ry="26" fill="rgba(93,138,86,0.16)" />
          <ellipse cx="228" cy="70" rx="20" ry="16" fill="rgba(93,138,86,0.14)" />

          {/* Нева — широкой лентой через весь экран, как настоящая река */}
          <path
            d="M-20 340 C 40 300, 70 270, 130 250 C 190 230, 210 190, 190 140 C 175 105, 150 70, 165 -20"
            stroke="rgba(15,118,110,0.16)"
            strokeWidth="34"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M-20 340 C 40 300, 70 270, 130 250 C 190 230, 210 190, 190 140 C 175 105, 150 70, 165 -20"
            stroke="rgba(15,118,110,0.28)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />

          {/* магистрали */}
          <path d="M-10 90 C 60 60,120 130,270 100" stroke="var(--color-border)" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M-10 230 C 70 200,110 300,270 260" stroke="var(--color-border)" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M50 -10 C 30 140,90 220,70 350" stroke="var(--color-border)" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M190 -10 C 205 150,150 230,180 380" stroke="var(--color-border)" strokeWidth="7" fill="none" strokeLinecap="round" />

          {/* второстепенные улицы — плотнее сетка, честнее ощущение города */}
          <g stroke="var(--color-border)" strokeWidth="3" fill="none" opacity="0.75" strokeLinecap="round">
            <path d="M0 60 L 260 46" />
            <path d="M0 180 L 260 170" />
            <path d="M0 320 L 260 300" />
            <path d="M20 0 L 34 460" />
            <path d="M120 0 L 108 460" />
            <path d="M230 0 L 244 460" />
          </g>
        </svg>

        {/* лёгкий блик стекла поверх экрана */}
        <div style={glassGlareStyle} />

        {/* хедер экрана приложения */}
        <div style={appHeaderStyle}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "var(--color-primary)" }}>
            Appetite
          </span>
          <div style={bellDotStyle} />
        </div>

        {/* пины — реальные офферы */}
        {offers?.map((offer, i) => {
          const pos = PIN_POSITIONS[i];
          if (!pos) return null;
          const hot = offer.discountPercent >= HOT_DISCOUNT_THRESHOLD;
          return (
            <div
              key={offer.id}
              style={{
                ...pinStyle,
                left: pos.x,
                top: pos.y,
                background: hot ? "var(--color-danger)" : "var(--color-primary)",
                width: hot ? 44 : 38,
                height: hot ? 44 : 38,
              }}
            >
              <span style={{ transform: "rotate(45deg)", fontSize: hot ? 11 : 10 }}>−{offer.discountPercent}%</span>
            </div>
          );
        })}

        {/* bottom sheet — кликабельно */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ ...sheetStyle, height: expanded ? 260 : 118 }}
          aria-expanded={expanded}
          aria-label={expanded ? "Свернуть список предложений" : "Показать все предложения"}
          disabled={!offers?.length}
        >
          <div style={handleStyle} />
          <div style={sheetHeaderRow}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-ink)" }}>Рядом сейчас</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)" }}>
              {expanded ? "Свернуть" : "Все →"}
            </span>
          </div>

          {expanded ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 14px 14px" }}>
              {offers?.map((offer) => (
                <MiniCard
                  key={offer.id}
                  title={offer.title}
                  price={`${(offer.discountedPrice / 100).toFixed(0)} ₽`}
                  discount={`−${offer.discountPercent}%`}
                  hot={offer.discountPercent >= HOT_DISCOUNT_THRESHOLD}
                />
              ))}
            </div>
          ) : hotOffer ? (
            <div style={miniCardRow}>
              <MiniCard
                title={hotOffer.title}
                price={`${(hotOffer.discountedPrice / 100).toFixed(0)} ₽`}
                discount={`−${hotOffer.discountPercent}%`}
                hot={hotOffer.discountPercent >= HOT_DISCOUNT_THRESHOLD}
                wide
              />
            </div>
          ) : null}
        </button>
      </div>
    </div>
  );
}

function MiniCard({
  title,
  price,
  discount,
  hot,
  wide,
}: {
  title: string;
  price: string;
  discount: string;
  hot?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-elevated)",
        border: `1.5px solid ${hot ? "var(--color-danger)" : "var(--color-border)"}`,
        borderRadius: 12,
        padding: "8px 10px",
        textAlign: "left",
        width: wide ? "100%" : undefined,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            color: "#fff",
            background: hot ? "var(--color-danger)" : "var(--color-primary)",
            borderRadius: 999,
            padding: "1px 6px",
            flexShrink: 0,
          }}
        >
          {discount}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-primary)", marginTop: 3 }}>{price}</div>
    </div>
  );
}

const frameStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "280 / 560",
  // Металлический корпус вместо плоской заливки — градиент имитирует то, как
  // свет скользит по титановому/алюминиевому ободу настоящего телефона.
  background: "linear-gradient(160deg, #3f3f42 0%, #1c1c1e 40%, #030303 100%)",
  borderRadius: 46,
  padding: 9,
  boxShadow: "0 30px 60px rgba(18,16,13,0.32), 0 2px 0 rgba(255,255,255,0.06) inset",
  position: "relative",
};

const sideButtonStyle: CSSProperties = {
  position: "absolute",
  width: 3,
  background: "linear-gradient(90deg, #0a0a0a, #333)",
  borderRadius: 2,
};

const islandStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  left: "50%",
  transform: "translateX(-50%)",
  width: 76,
  height: 22,
  background: "#000",
  borderRadius: 14,
  zIndex: 3,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingRight: 6,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset",
};

const cameraDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "radial-gradient(circle at 35% 35%, #3a4a55, #0a0f12)",
};

const screenStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  borderRadius: 38,
  overflow: "hidden",
  background: "var(--color-background)",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.05) inset",
};

const glassGlareStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.10) 50%, transparent 58%)",
  pointerEvents: "none",
};

const appHeaderStyle: CSSProperties = {
  position: "absolute",
  top: 14,
  left: 16,
  right: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  zIndex: 1,
};

const bellDotStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border)",
};

const pinStyle: CSSProperties = {
  position: "absolute",
  borderRadius: "50% 50% 50% 0",
  border: "2.5px solid var(--color-background)",
  transform: "rotate(-45deg)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: 800,
  boxShadow: "0 4px 10px rgba(18,16,13,0.2)",
  transition: "opacity 0.3s ease",
};

const sheetStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  background: "var(--color-surface-elevated)",
  borderRadius: "20px 20px 0 0",
  boxShadow: "0 -6px 20px rgba(18,16,13,0.12)",
  transition: "height 0.35s cubic-bezier(0.22,1,0.36,1)",
  overflow: "hidden",
  border: "none",
  padding: 0,
  cursor: "pointer",
  font: "inherit",
  display: "block",
  width: "100%",
};

const handleStyle: CSSProperties = {
  width: 28,
  height: 3,
  borderRadius: 999,
  background: "var(--color-border)",
  margin: "8px auto 6px",
};

const sheetHeaderRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 14px 10px",
};

const miniCardRow: CSSProperties = {
  padding: "0 14px 14px",
};
