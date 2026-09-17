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
            <span style={badgeStyle}>Бета · Москва</span>
            <h1 style={h1Style}>
              Вкусная еда рядом —<br />
              со скидкой до <span style={{ color: "var(--color-primary)" }}>70%</span>
            </h1>
            <p style={{ fontSize: 18, color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: 20 }}>
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
      </section>

      <section id="how" style={{ padding: "96px 0" }}>
        <div className="container">
          <SectionHeading eyebrow="Как это работает" title="Три шага до спасённого ужина" />
          <div ref={stepsRef} className="reveal" style={stepsGridStyle}>
            {STEPS.map((step, index) => (
              <div key={step.title} className="card" style={{ padding: 28 }}>
                <div style={stepIconStyle}>{step.icon}</div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6 }}>
                  Шаг {index + 1}
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: "var(--color-ink-muted)", lineHeight: 1.6 }}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="business" style={{ padding: "0 0 96px" }}>
        <div className="container">
          <div ref={businessRef} className="reveal" style={businessCardStyle}>
            <div style={{ maxWidth: 480 }}>
              <span style={{ ...badgeStyle, background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                Для заведений
              </span>
              <h2 style={{ fontSize: 30, fontWeight: 800, color: "#fff", marginTop: 16 }}>
                Продавай остатки, а не списывай их
              </h2>
              <p style={{ color: "rgba(255,255,255,0.85)", marginTop: 12, lineHeight: 1.6 }}>
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
          <div ref={faqRef} className="reveal" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQ.map((item) => (
              <details key={item.q} className="card" style={{ padding: "18px 22px" }}>
                <summary style={{ fontWeight: 700, cursor: "pointer", fontSize: 15 }}>{item.q}</summary>
                <p style={{ marginTop: 10, color: "var(--color-ink-muted)", lineHeight: 1.6, fontSize: 14 }}>
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
      <p style={{ fontSize: 22, fontWeight: 800 }}>{value}</p>
      <p style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>{label}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 48 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", letterSpacing: 0.4 }}>
        {eyebrow.toUpperCase()}
      </span>
      <h2 style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{title}</h2>
    </div>
  );
}

const heroStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 70%)",
  paddingTop: 64,
  overflow: "hidden",
};

const heroInnerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 40,
  flexWrap: "wrap",
  paddingBottom: 64,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  background: "var(--color-primary-soft)",
  color: "var(--color-primary)",
  fontSize: 13,
  fontWeight: 700,
  padding: "6px 14px",
  borderRadius: "var(--radius-full)",
};

const h1Style: React.CSSProperties = {
  fontSize: "clamp(32px, 5vw, 52px)",
  fontWeight: 800,
  lineHeight: 1.12,
  marginTop: 20,
  letterSpacing: -0.5,
};

const phoneWrapStyle: React.CSSProperties = {
  flex: "0 0 auto",
  width: 280,
  maxWidth: "80vw",
  margin: "0 auto",
};

const stepsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 24,
};

const stepIconStyle: React.CSSProperties = {
  fontSize: 32,
  marginBottom: 16,
};

const businessCardStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #1a1a1a 0%, #3a2417 100%)",
  borderRadius: "var(--radius-lg)",
  padding: "56px 40px",
};
