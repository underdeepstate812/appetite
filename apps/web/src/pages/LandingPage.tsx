import { Link } from "react-router-dom";
import { PhoneMockup } from "../components/PhoneMockup";
import { useReveal } from "../hooks/useReveal";

const STEPS = [
  {
    icon: "🔍",
    title: "Находи рядом",
    text: "Кафе, пекарни, цветочные и магазины продают остатки дня со скидкой 50–70% в радиусе пары километров.",
  },
  {
    icon: "🧑‍🍳",
    title: "Оплачивай в приложении",
    text: "Бронируешь и оплачиваешь за секунды — выбор способа оплаты, честная сумма, никаких сюрпризов на кассе.",
  },
  {
    icon: "🍊",
    title: "Забирай за 1–3 часа",
    text: "Показываешь QR или называешь код на кассе — и уносишь то, что иначе оказалось бы в мусоре.",
  },
];

const FAQ = [
  {
    q: "Это подписка?",
    a: "Нет. Платишь только за то, что покупаешь — комиссия платформы уже включена в цену на витрине.",
  },
  {
    q: "Что будет, если я не заберу заказ?",
    a: "Место остаётся забронированным до конца окна самовывоза, но при просрочке заказ автоматически отменяется — стоит рассчитывать время заранее.",
  },
  {
    q: "В каких городах работает Apetite?",
    a: "Пилот идёт в Москве. Список заведений и категорий расширяется постепенно.",
  },
];

export function LandingPage() {
  const heroRef = useReveal<HTMLDivElement>();
  const phoneRef = useReveal<HTMLDivElement>();
  const stepsRef = useReveal<HTMLDivElement>();
  const businessRef = useReveal<HTMLDivElement>();
  const faqRef = useReveal<HTMLDivElement>();

  return (
    <>
      <section style={heroStyle}>
        <div className="container" style={heroInnerStyle}>
          <div ref={heroRef} className="reveal" style={{ maxWidth: 560 }}>
            <span className="stamp" style={{ color: "var(--color-primary-soft)", borderColor: "var(--color-primary-soft)" }}>
              ✦ Бета · Москва
            </span>
            <h1 style={h1Style}>
              Вкусная еда рядом —<br />
              со скидкой до{" "}
              <span style={{ fontStyle: "italic", color: "var(--color-primary-soft)" }}>70%</span>
            </h1>
            <p style={{ fontSize: 18, color: "rgba(250,243,230,0.72)", lineHeight: 1.6, marginTop: 20 }}>
              Заведения продают то, что иначе спишут в конце дня — ты забираешь
              самовывозом за 1–3 часа. Хорошо для кошелька, хорошо для планеты.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <Link to="/register" className="btn btn-primary">
                Начать бесплатно
              </Link>
              <a href="#how" className="btn btn-secondary">
                Как это работает
              </a>
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 48 }}>
              <Stat value="50–70%" label="скидка на витрине" />
              <Stat value="1–3 ч" label="окно самовывоза" />
              <Stat value="4" label="категории: еда, выпечка, цветы, продукты" />
            </div>
          </div>

          <div ref={phoneRef} className="reveal" style={phoneWrapStyle}>
            <div className="phone-tilt">
              <PhoneMockup />
            </div>
          </div>
        </div>
        <div style={tornDividerStyle} />
      </section>

      <section id="how" style={{ padding: "112px 0 96px" }}>
        <div className="container">
          <SectionHeading eyebrow="Как это работает" title="Три шага до спасённого ужина" />
          <div ref={stepsRef} className="reveal" style={stepsGridStyle}>
            {STEPS.map((step, index) => (
              <div key={step.title} className="card card-hover" style={{ padding: "28px 28px 32px", position: "relative", overflow: "hidden" }}>
                <span style={stepGhostNumberStyle}>{index + 1}</span>
                <div style={stepIconStyle}>{step.icon}</div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>
                  Шаг {index + 1}
                </p>
                <h3 style={{ fontSize: 20, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: "var(--color-ink-muted)", lineHeight: 1.6 }}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="business" style={{ padding: "0 0 96px" }}>
        <div className="container">
          <div ref={businessRef} className="reveal" style={businessCardStyle}>
            <div style={{ maxWidth: 480, position: "relative" }}>
              <span
                className="stamp"
                style={{ color: "var(--color-secondary-soft)", borderColor: "var(--color-secondary-soft)" }}
              >
                ✦ Для заведений
              </span>
              <h2 style={{ fontSize: "clamp(26px, 3.4vw, 34px)", color: "#fffbf3", marginTop: 18 }}>
                Продавай остатки,
                <br />
                <span style={{ fontStyle: "italic", color: "var(--color-secondary-soft)" }}>не списывай</span> их
              </h2>
              <p style={{ color: "rgba(255,251,243,0.78)", marginTop: 14, lineHeight: 1.6, fontSize: 15 }}>
                Панель бизнеса — офферы, заказы и аналитика в реальном времени.
                Онбординг — вручную через платформу, комиссия настраивается индивидуально.
              </p>
              <a
                href="mailto:hello@apetite.ru?subject=Подключить заведение"
                className="btn btn-secondary"
                style={{ marginTop: 24 }}
              >
                Подключить заведение
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" style={{ padding: "0 0 96px" }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <SectionHeading eyebrow="Вопросы" title="Если что-то осталось непонятным" />
          <div ref={faqRef} className="reveal" style={faqListStyle}>
            {FAQ.map((item, index) => (
              <details key={item.q} style={faqItemStyle}>
                <summary style={faqSummaryStyle}>
                  <span style={faqIndexStyle}>{String(index + 1).padStart(2, "0")}</span>
                  {item.q}
                  <span className="faq-chevron" aria-hidden="true" style={{ marginLeft: "auto", fontFamily: "var(--font-display)" }}>
                    +
                  </span>
                </summary>
                <p style={{ marginTop: 10, marginLeft: 40, color: "var(--color-ink-muted)", lineHeight: 1.6, fontSize: 14 }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--color-primary-soft)" }}>
        {value}
      </p>
      <p style={{ fontSize: 13, color: "rgba(250,243,230,0.65)" }}>{label}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 48 }}>
      <span className="eyebrow">{eyebrow.toUpperCase()}</span>
      <h2 style={{ fontSize: "clamp(26px, 3.4vw, 36px)", marginTop: 10 }}>{title}</h2>
    </div>
  );
}

const heroStyle: React.CSSProperties = {
  background: "linear-gradient(165deg, #241a10 0%, #1c1712 55%, #241a10 100%)",
  paddingTop: 56,
  overflow: "hidden",
  position: "relative",
};

const heroInnerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 40,
  flexWrap: "wrap",
  paddingBottom: 72,
  position: "relative",
  zIndex: 1,
};

const h1Style: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(34px, 5vw, 56px)",
  fontWeight: 600,
  lineHeight: 1.1,
  marginTop: 22,
  letterSpacing: "-0.01em",
  color: "#fffbf3",
};

const phoneWrapStyle: React.CSSProperties = {
  flex: "0 0 auto",
  width: 280,
  maxWidth: "80vw",
  margin: "0 auto",
  transform: "rotate(4deg)",
};

/* Рваный бумажный край между hero и следующей секцией — зигзаг через repeating-linear-gradient,
   держит "рыночный чек" тон, без веса SVG/картинки. */
const tornDividerStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: -1,
  height: 22,
  background:
    "linear-gradient(-45deg, var(--color-background) 12px, transparent 0), linear-gradient(45deg, var(--color-background) 12px, transparent 0)",
  backgroundSize: "24px 24px",
  backgroundRepeat: "repeat-x",
  backgroundPosition: "bottom",
};

const stepsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 24,
};

const stepIconStyle: React.CSSProperties = {
  fontSize: 32,
  marginBottom: 16,
  position: "relative",
};

const stepGhostNumberStyle: React.CSSProperties = {
  position: "absolute",
  top: -18,
  right: -6,
  fontFamily: "var(--font-display)",
  fontSize: 96,
  fontWeight: 600,
  color: "var(--color-surface)",
  lineHeight: 1,
  zIndex: 0,
  userSelect: "none",
};

const businessCardStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #1c1712 0%, #3a2417 100%)",
  borderRadius: "var(--radius-lg)",
  padding: "56px 40px",
  border: "2px solid var(--color-ink)",
  boxShadow: "6px 6px 0 var(--color-primary)",
};

const faqListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const faqItemStyle: React.CSSProperties = {
  padding: "18px 4px",
  borderBottom: "1.5px solid var(--color-border)",
};

const faqSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 17,
  listStyle: "none",
};

const faqIndexStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--color-primary)",
};
