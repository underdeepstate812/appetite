import { useState, type CSSProperties } from "react";

interface Pin {
  x: number;
  y: number;
  label: string;
  hot?: boolean;
}

const PINS: Pin[] = [
  { x: 78, y: 128, label: "−40%" },
  { x: 168, y: 96, label: "−70%", hot: true },
  { x: 60, y: 248, label: "−55%" },
  { x: 190, y: 232, label: "−45%" },
];

/**
 * Макет телефона с картой предложений — теперь по-настоящему интерактивный:
 * клик по нижней панели (bottom sheet) разворачивает список офферов поверх
 * карты, ровно как в реальном интерфейсе мобильного приложения (см. концепт
 * "карта + bottom sheet" — apps/mobile HomeScreen). Раньше это была статичная
 * SVG-картинка; теперь HTML/CSS-макет с реальным состоянием, а не имитация.
 */
export function PhoneMockup() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={frameStyle}>
      <div style={notchStyle} />
      <div style={screenStyle}>
        {/* карта */}
        <svg viewBox="0 0 260 460" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <rect width="260" height="460" fill="var(--color-surface)" />
          <path d="M-10 90 C 60 60,120 130,270 100" stroke="var(--color-border)" strokeWidth="9" fill="none" />
          <path d="M-10 230 C 70 200,110 300,270 260" stroke="var(--color-border)" strokeWidth="8" fill="none" />
          <path d="M50 -10 C 30 140,90 220,70 350" stroke="var(--color-border)" strokeWidth="7" fill="none" />
          <path d="M190 -10 C 205 150,150 230,180 380" stroke="var(--color-border)" strokeWidth="7" fill="none" />
        </svg>

        {/* хедер экрана приложения */}
        <div style={appHeaderStyle}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "var(--color-primary)" }}>
            Apetite
          </span>
          <div style={bellDotStyle} />
        </div>

        {/* пины */}
        {PINS.map((pin, i) => (
          <div
            key={i}
            style={{
              ...pinStyle,
              left: pin.x,
              top: pin.y,
              background: pin.hot ? "var(--color-danger)" : "var(--color-primary)",
              width: pin.hot ? 44 : 38,
              height: pin.hot ? 44 : 38,
            }}
          >
            <span style={{ transform: "rotate(45deg)", fontSize: pin.hot ? 11 : 10 }}>{pin.label}</span>
          </div>
        ))}

        {/* bottom sheet — кликабельно */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ ...sheetStyle, height: expanded ? 260 : 118 }}
          aria-expanded={expanded}
          aria-label={expanded ? "Свернуть список предложений" : "Показать все предложения"}
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
              <MiniCard title="Сеты дня" price="210 ₽" discount="−45%" />
              <MiniCard title="Выпечка" price="150 ₽" discount="−55%" />
              <MiniCard title="Букеты" price="390 ₽" discount="−40%" />
              <MiniCard title="Ужин" price="280 ₽" discount="−70%" hot />
            </div>
          ) : (
            <div style={miniCardRow}>
              <MiniCard title="Ужин на двоих" price="280 ₽" discount="−70%" hot wide />
            </div>
          )}
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
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-ink)" }}>{title}</span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            color: "#fff",
            background: hot ? "var(--color-danger)" : "var(--color-primary)",
            borderRadius: 999,
            padding: "1px 6px",
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
  background: "var(--color-ink)",
  borderRadius: 38,
  padding: 8,
  boxShadow: "0 20px 50px rgba(18,16,13,0.25)",
  position: "relative",
};

const notchStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  left: "50%",
  transform: "translateX(-50%)",
  width: "34%",
  height: 14,
  background: "var(--color-ink)",
  borderRadius: 8,
  zIndex: 2,
};

const screenStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  borderRadius: 30,
  overflow: "hidden",
  background: "var(--color-background)",
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
