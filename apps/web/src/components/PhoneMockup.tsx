import { useEffect, useState, type CSSProperties } from "react";
import type { NearbyOffer } from "@apetite/shared";
import { offersApi } from "../api/offers";
import { LeafletMapView } from "./LeafletMapView";

/**
 * Центр карты мокапа — сейчас всегда Петербург (единственный пилотный регион),
 * но вынесен в константу, а не зашит в JSX: когда сервис откроется в новых
 * городах, здесь достаточно будет подставить центр по геопозиции посетителя
 * (или выбранному им региону) вместо жёсткого SPB_CENTER — LeafletMapView уже
 * принимает center пропом именно ради этого.
 */
const SPB_CENTER = { lat: 59.9311, lng: 30.3609 };
const MAP_ZOOM = 14;
const RADIUS_KM = 20;
const PIN_COUNT = 4;
/** Порог "горящей" скидки — тот же, что и в ленте предложений (OffersRibbon). */
const HOT_DISCOUNT_THRESHOLD = 60;

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
 * Макет телефона с картой предложений — и карта, и пины теперь настоящие:
 * OpenStreetMap-тайлы через Leaflet (см. LeafletMapView), маркеры стоят на
 * реальных координатах заведений, карточки нижней панели — реальные активные
 * офферы (GET /offers/nearby), не выдуманные строки. Выборка рандомная при
 * каждой загрузке страницы, но взвешена в пользу скидок 50%+ (см. weightedSample).
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
        {/* настоящая карта (OSM/Leaflet) — жесты отключены, это иллюстрация экрана */}
        <LeafletMapView center={SPB_CENTER} zoom={MAP_ZOOM} offers={offers ?? []} />

        {/* лёгкий блик стекла поверх экрана */}
        <div style={glassGlareStyle} />

        {/* хедер экрана приложения */}
        <div style={appHeaderStyle}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "var(--color-primary)" }}>
            Appetite
          </span>
          <div style={bellDotStyle} />
        </div>

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
