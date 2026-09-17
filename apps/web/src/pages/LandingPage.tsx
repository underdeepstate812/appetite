import { useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import { Search, CreditCard, ShoppingBag } from "lucide-react";
import { PhoneMockup } from "../components/PhoneMockup";
import { OffersRibbon } from "../components/OffersRibbon";
import { IconBadge } from "../components/IconBadge";
import { useReveal } from "../hooks/useReveal";
import { useCountUp } from "../hooks/useCountUp";

const STEPS = [
  {
    icon: Search,
    title: "Находи рядом",
    text: "Кафе, пекарни, цветочные и магазины города — скидки 40–70% в радиусе пары километров.",
  },
  {
    icon: CreditCard,
    title: "Оплачивай в приложении",
    text: "Бронируешь и оплачиваешь за секунды — выбор способа оплаты, честная сумма, никаких сюрпризов на кассе.",
  },
  {
    icon: ShoppingBag,
    title: "Забирай за 1–3 часа",
    text: "Показываешь QR или называешь код на кассе — и забираешь то, что выбрал, тёплым и свежим.",
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
        <div className="container" style={heroInnerStyle}>
          <div ref={heroRef} className="reveal" style={{ maxWidth: 560 }}>
            <span className="stamp">Бета · Москва</span>
            <h1 style={h1Style}>
              Вкусная еда рядом —<br />
              со скидкой до{" "}
              <span style={{ fontStyle: "italic", color: "var(--color-primary)" }}>{animatedPercent}%</span>
            </h1>
            <p style={{ fontSize: 18, color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: 20 }}>
              Кафе, рестораны и магазины города — со скидкой 40–70% на позиции дня.
              Бронируешь в приложении, забираешь самовывозом за 1–3 часа.
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
              <Stat value="40–70%" label="скидка на витрине" />
              <Stat value="1–3 ч" label="окно самовывоза" />
              <Stat countTo={4} active={heroInView} label="категории: еда, выпечка, цветы, продукты" />
            </div>
          </div>

          <div ref={phoneRef} className="reveal" style={phoneWrapStyle}>
            <TiltPhone />
          </div>
        </div>
      </section>

      <OffersRibbon />

      <section id="how" style={{ padding: "96px 0" }}>
        <div className="container">
          <SectionHeading eyebrow="Как это работает" title="Три шага до вкусной скидки" />
          <div ref={stepsRef} className="reveal bento-grid">
            {STEPS.map((step, index) =>
              index === 0 ? (
                <div key={step.title} className="card card-hover bento-large" style={bentoLargeStyle}>
                  <span className="step-accent" aria-hidden="true" />
                  <IconBadge icon={step.icon} size="lg" className="step-icon-badge" />
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
                  <span className="step-accent" aria-hidden="true" />
                  <span style={stepGhostNumberStyle}>{index + 1}</span>
                  <div style={{ marginBottom: 16, position: "relative" }}>
                    <IconBadge icon={step.icon} className="step-icon-badge" />
                  </div>
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
            <div style={{ maxWidth: 480 }}>
              <span className="stamp" style={{ background: "rgba(255,253,249,0.12)", color: "var(--color-background)" }}>
                Для заведений
              </span>
              <h2 style={{ fontSize: "clamp(26px, 3.4vw, 34px)", color: "var(--color-background)", marginTop: 18 }}>
                Привлекай новых гостей{" "}
                <span style={{ fontStyle: "italic", color: "var(--color-primary-soft)" }}>скидками 40–70%</span>
              </h2>
              <p style={{ color: "rgba(255,253,249,0.68)", marginTop: 14, lineHeight: 1.6, fontSize: 15 }}>
                Панель бизнеса — офферы, заказы и аналитика в реальном времени. Скидка
                настраивается от 40 до 70%, комиссия — индивидуально под твоё заведение.
              </p>
              <a
                href="mailto:hello@apetite.ru?subject=Подключить заведение"
                className="btn btn-secondary"
                style={{ marginTop: 24, background: "var(--color-background)" }}
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
    transform: "perspective(900px) rotateY(8deg) rotateX(-2deg)",
  });

  const handleMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(900px) rotateX(${py * -12}deg) rotateY(${px * 16}deg) scale(1.03)`,
    });
  };

  const handleLeave = () => {
    setStyle({ transform: "perspective(900px) rotateY(8deg) rotateX(-2deg)" });
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
  background: "linear-gradient(180deg, var(--color-surface) 0%, var(--color-background) 70%)",
  paddingTop: 56,
};

const heroInnerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 40,
  flexWrap: "wrap",
  paddingBottom: 80,
};

const h1Style: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(34px, 5vw, 54px)",
  fontWeight: 700,
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

const stepGhostNumberStyle: CSSProperties = {
  position: "absolute",
  top: -18,
  right: -6,
  fontFamily: "var(--font-display)",
  fontSize: 96,
  fontWeight: 700,
  color: "rgba(15,118,110,0.07)",
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

const businessCardStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "var(--color-ink)",
  borderRadius: "var(--radius-lg)",
  padding: "56px 40px",
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
  fontWeight: 700,
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
  fontWeight: 700,
  color: "var(--color-primary)",
};
