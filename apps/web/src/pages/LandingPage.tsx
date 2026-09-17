import { useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import { PhoneMockup } from "../components/PhoneMockup";
import { useReveal } from "../hooks/useReveal";
import { useCountUp } from "../hooks/useCountUp";

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

/* Магнитная кнопка — сдвигается за курсором внутри своих границ, отпускает при
   уходе мыши. Работает через прямую правку DOM-style (не React state), чтобы не
   гонять лишние ре-рендеры на каждый pixel курсора. */
function magneticMove<T extends HTMLElement>(event: ReactMouseEvent<T>) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 16;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 16;
  el.style.transform = `translate(${x}px, ${y}px)`;
}

function magneticLeave<T extends HTMLElement>(event: ReactMouseEvent<T>) {
  event.currentTarget.style.transform = "";
}

export function LandingPage() {
  const [heroInView, setHeroInView] = useState(false);
  const heroRef = useReveal<HTMLDivElement>(() => setHeroInView(true));
  const phoneRef = useReveal<HTMLDivElement>();
  const stepsRef = useReveal<HTMLDivElement>();
  const businessRef = useReveal<HTMLDivElement>();
  const faqRef = useReveal<HTMLDivElement>();

  const animatedPercent = useCountUp(70, heroInView, 1400);

  return (
    <>
      <section style={heroStyle}>
        <div className="aurora-bg" aria-hidden="true" />
        <div className="container" style={heroInnerStyle}>
          <div ref={heroRef} className="reveal" style={{ maxWidth: 560 }}>
            <span className="stamp">✦ Бета · Москва</span>
            <h1 style={h1Style}>
              Вкусная еда рядом —<br />
              со скидкой до{" "}
              <span style={{ fontStyle: "italic", color: "var(--color-primary)" }}>{animatedPercent}%</span>
            </h1>
            <p style={{ fontSize: 18, color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: 20 }}>
              Заведения продают то, что иначе спишут в конце дня — ты забираешь
              самовывозом за 1–3 часа. Хорошо для кошелька, хорошо для планеты.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <Link
                to="/register"
                className="btn btn-primary"
                onMouseMove={magneticMove}
                onMouseLeave={magneticLeave}
              >
                Начать бесплатно
              </Link>
              <a
                href="#how"
                className="btn btn-secondary"
                onMouseMove={magneticMove}
                onMouseLeave={magneticLeave}
              >
                Как это работает
              </a>
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 48 }}>
              <Stat value="50–70%" label="скидка на витрине" />
              <Stat value="1–3 ч" label="окно самовывоза" />
              <Stat countTo={4} active={heroInView} label="категории: еда, выпечка, цветы, продукты" />
            </div>
          </div>

          <div ref={phoneRef} className="reveal" style={phoneWrapStyle}>
            <TiltPhone />
          </div>
        </div>
        <div style={heroFadeStyle} aria-hidden="true" />
      </section>

      <section id="how" style={{ padding: "112px 0 96px" }}>
        <div className="container">
          <SectionHeading eyebrow="Как это работает" title="Три шага до спасённого ужина" />
          <div ref={stepsRef} className="reveal bento-grid">
            {STEPS.map((step, index) =>
              index === 0 ? (
                <div key={step.title} className="card card-hover bento-large" style={bentoLargeStyle}>
                  <div style={bentoLargeIconStyle}>{step.icon}</div>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 6 }}>
                      Шаг 1
                    </p>
                    <h3 style={{ fontSize: 22, marginBottom: 8 }}>{step.title}</h3>
                    <p style={{ fontSize: 15, color: "var(--color-ink-muted)", lineHeight: 1.6, maxWidth: 480 }}>
                      {step.text}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  key={step.title}
                  className="card card-hover bento-small"
                  style={{ padding: "28px 28px 32px", position: "relative", overflow: "hidden" }}
                >
                  <span style={stepGhostNumberStyle}>{index + 1}</span>
                  <div style={stepIconStyle}>{step.icon}</div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>
                    Шаг {index + 1}
                  </p>
                  <h3 style={{ fontSize: 20, marginBottom: 8 }}>{step.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--color-ink-muted)", lineHeight: 1.6 }}>{step.text}</p>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section id="business" style={{ padding: "0 0 96px" }}>
        <div className="container">
          <div ref={businessRef} className="reveal" style={businessCardStyle}>
            <div className="aurora-bg" style={{ opacity: 0.35 }} aria-hidden="true" />
            <div style={{ maxWidth: 480, position: "relative", zIndex: 1 }}>
              <span className="stamp">✦ Для заведений</span>
              <h2 style={{ fontSize: "clamp(26px, 3.4vw, 34px)", color: "var(--color-ink)", marginTop: 18 }}>
                Продавай остатки,
                <br />
                <span style={{ fontStyle: "italic", color: "var(--color-secondary)" }}>не списывай</span> их
              </h2>
              <p style={{ color: "var(--color-ink-muted)", marginTop: 14, lineHeight: 1.6, fontSize: 15 }}>
                Панель бизнеса — офферы, заказы и аналитика в реальном времени.
                Онбординг — вручную через платформу, комиссия настраивается индивидуально.
              </p>
              <a
                href="mailto:hello@apetite.ru?subject=Подключить заведение"
                className="btn btn-secondary"
                style={{ marginTop: 24 }}
                onMouseMove={magneticMove}
                onMouseLeave={magneticLeave}
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

/* 3D-наклон макета телефона вслед за курсором (десктоп) — на тач-устройствах
   мышь не двигается сама по себе, так что там просто остаётся исходный ракурс. */
function TiltPhone() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    transform: "perspective(900px) rotateY(10deg) rotateX(-3deg)",
  });

  const handleMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(900px) rotateX(${py * -16}deg) rotateY(${px * 20}deg) scale(1.04)`,
    });
  };

  const handleLeave = () => {
    setStyle({ transform: "perspective(900px) rotateY(10deg) rotateX(-3deg)" });
  };

  return (
    <div ref={wrapRef} className="tilt-card" style={style} onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <PhoneMockup />
    </div>
  );
}

function Stat({
  value,
  label,
  countTo,
  active,
}: {
  value?: string;
  label: string;
  countTo?: number;
  active?: boolean;
}) {
  const animated = useCountUp(countTo ?? 0, Boolean(active && countTo !== undefined));

  return (
    <div>
      <p style={statValueStyle}>{countTo !== undefined ? animated : value}</p>
      <p style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>{label}</p>
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

const heroStyle: CSSProperties = {
  background: "radial-gradient(ellipse 100% 60% at 50% 0%, #131c14 0%, var(--color-background) 65%)",
  paddingTop: 56,
  overflow: "hidden",
  position: "relative",
};

const heroInnerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 40,
  flexWrap: "wrap",
  paddingBottom: 96,
  position: "relative",
  zIndex: 1,
};

const h1Style: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(34px, 5vw, 54px)",
  fontWeight: 600,
  lineHeight: 1.1,
  marginTop: 22,
  letterSpacing: "-0.01em",
  color: "var(--color-ink)",
};

const phoneWrapStyle: CSSProperties = {
  flex: "0 0 auto",
  width: 280,
  maxWidth: "80vw",
  margin: "0 auto",
};

/* Плавный переход из hero в основной фон — вместо жёсткой границы, в духе
   "liquid" направления (было: рваный бумажный край в прошлой версии дизайна). */
const heroFadeStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: -1,
  height: 160,
  background: "linear-gradient(180deg, transparent, var(--color-background))",
  pointerEvents: "none",
};

const stepIconStyle: CSSProperties = {
  fontSize: 32,
  marginBottom: 16,
  position: "relative",
};

const stepGhostNumberStyle: CSSProperties = {
  position: "absolute",
  top: -18,
  right: -6,
  fontFamily: "var(--font-display)",
  fontSize: 96,
  fontWeight: 600,
  color: "rgba(255,255,255,0.04)",
  lineHeight: 1,
  zIndex: 0,
  userSelect: "none",
};

const bentoLargeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 32,
  padding: "36px 40px",
  flexWrap: "wrap",
};

const bentoLargeIconStyle: CSSProperties = {
  fontSize: 56,
  flexShrink: 0,
};

const businessCardStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
  backdropFilter: "var(--glass-blur)",
  borderRadius: "var(--radius-lg)",
  padding: "56px 40px",
  border: "1px solid var(--color-border)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
};

const faqListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const faqItemStyle: CSSProperties = {
  padding: "18px 4px",
  borderBottom: "1.5px solid var(--color-border)",
};

const faqSummaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 17,
  listStyle: "none",
};

const faqIndexStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--color-primary)",
};

const statValueStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 24,
  fontWeight: 600,
  color: "var(--color-primary)",
};
