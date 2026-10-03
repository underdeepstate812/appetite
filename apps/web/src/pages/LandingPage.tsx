import { Fragment, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PhoneMockup } from "../components/PhoneMockup";
import { OffersRibbon } from "../components/OffersRibbon";
import { StepScene, type StepSceneKind } from "../components/StepScene";
import { useReveal } from "../hooks/useReveal";
import { useCountUp } from "../hooks/useCountUp";

const STEPS = [
  {
    scene: "map" as StepSceneKind,
    sceneLabel: "Карта города с маршрутом до заведения русской кухни, отмеченного на карте",
    title: "Находи рядом",
    text: "Кафе, пекарни, цветочные и магазины города — скидки 25–70% в радиусе пары километров.",
  },
  {
    scene: "pay" as StepSceneKind,
    sceneLabel: "Перевод денег с банковской карты покупателя на карту заведения",
    title: "Оплачивай в приложении",
    text: "Бронируешь и оплачиваешь за секунды — выбор способа оплаты, честная сумма, никаких сюрпризов на кассе.",
  },
  {
    scene: "pickup" as StepSceneKind,
    sceneLabel: "Готовый заказ в пакете и QR-код для получения на кассе",
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
    q: "В каких городах работает Appetite?",
    a: "Пилот идёт в Санкт-Петербурге. Список заведений и категорий расширяется постепенно.",
  },
  {
    q: "Как Appetite зарабатывает на заказах?",
    a: "Мы — агрегатор на агентской схеме: принимаем оплату от покупателя в приложении, удерживаем с заведения агентское вознаграждение 25% от суммы продаж через Платформу (без учёта НДС), а оставшиеся 75% перечисляем заведению.",
  },
  {
    q: "Сколько стоит подключить заведение к Appetite?",
    a: "На старте — ничего: первые 20–30 дней подключение бесплатное, комиссия не удерживается. Нет платы за регистрацию и ежемесячных платежей — если продаж не было, начислений тоже нет. Выплаты заведению — автоматически, не позднее 5 числа следующего месяца.",
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
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const heroRef = useReveal<HTMLDivElement>(() => setHeroInView(true));
  const phoneRef = useReveal<HTMLDivElement>();
  const businessRef = useReveal<HTMLDivElement>();
  const faqRef = useReveal<HTMLDivElement>();

  const animatedPercent = useCountUp(70, heroInView, 1400);

  return (
    <>
      <section style={heroStyle}>
        <div className="container" style={heroInnerStyle}>
          <div ref={heroRef} className="reveal" style={{ maxWidth: 560 }}>
            <span className="stamp">Бета · Санкт-Петербург</span>
            <h1 style={h1Style}>
              Вкусная еда рядом —<br />
              со скидкой до{" "}
              <span style={{ fontStyle: "italic", color: "var(--color-primary)" }}>{animatedPercent}%</span>
            </h1>
            <p style={{ fontSize: 18, color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: 20 }}>
              Кафе, рестораны и магазины города — со скидкой 25–70% на позиции дня.
              Бронируешь и оплачиваешь на сайте или в приложении, забираешь самовывозом за 1–3 часа.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <Link
                to="/map"
                className="btn btn-primary"
                onMouseMove={magneticMove}
                onMouseLeave={magneticLeave}
              >
                Открыть карту
                <ArrowRight size={17} strokeWidth={2.4} className="btn-arrow" aria-hidden="true" />
              </Link>
              <a
                href="#how"
                className="btn btn-secondary"
                onMouseMove={magneticMove}
                onMouseLeave={magneticLeave}
              >
                Как это работает
                <ArrowUpRight size={17} strokeWidth={2.4} className="btn-arrow" aria-hidden="true" />
              </a>
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 48 }}>
              <Stat value="25–70%" label="скидка на витрине" />
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
          {/* Три карточки вместо маршрута — тот же материал бренда (сигнатурная форма угла,
              приглушённый тил-градиент в "фото"-зоне, как у офферов в ленте), но без лишнего
              иллюстративного шума. Средняя карточка чуть приподнята (margin, не transform —
              не спорит с её же въездом при скролле) ради лёгкой асимметрии: три одинаковых
              прямоугольника в ряд читались бы шаблонно, сдвиг делает композицию живой,
              оставаясь при этом внутри одной простой грид-сетки. Каждая карточка следит за
              собственным появлением в кадре (свой useReveal), а не общий для всех триггер —
              на мобильном (карточки друг под другом) это реально по одной "приезжают" по мере
              скролла, а не все разом. */}
          <div className="how-steps">
            {STEPS.map((step, index) => (
              <Fragment key={step.title}>
                <StepCard step={step} index={index} />
                {index < STEPS.length - 1 ? <StepConnector /> : null}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section id="business" style={{ padding: "0 0 96px" }}>
        <div className="container">
          <div ref={businessRef} className="reveal" style={businessCardStyle}>
            <div style={{ maxWidth: 480 }}>
              <span className="stamp" style={{ background: "rgba(255,253,249,0.12)", color: "var(--color-background)" }}>
                Для бизнеса
              </span>
              <h2 style={{ fontSize: "clamp(26px, 3.4vw, 34px)", color: "var(--color-background)", marginTop: 18 }}>
                Привлекай новых гостей{" "}
                <span style={{ fontStyle: "italic", color: "var(--color-primary-soft)" }}>скидками 25–70%</span>
              </h2>
              <p style={{ color: "rgba(255,253,249,0.68)", marginTop: 14, lineHeight: 1.6, fontSize: 15 }}>
                Панель бизнеса — офферы, заказы и аналитика в реальном времени. Скидка
                настраивается от 25 до 70%, комиссия платформы — 25% с заказов.
              </p>
              <Link
                to="/for-business"
                className="btn btn-secondary"
                style={{ marginTop: 24, background: "var(--color-background)" }}
                onMouseMove={magneticMove}
                onMouseLeave={magneticLeave}
              >
                Подключить заведение
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" style={{ padding: "0 0 96px" }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <SectionHeading eyebrow="Вопросы" title="Если что-то осталось непонятным" />
          <div ref={faqRef} className="reveal faq-list" style={faqListStyle}>
            {FAQ.map((item, index) => {
              const isOpen = openFaq === index;
              const panelId = `faq-panel-${index}`;
              return (
                <div key={item.q} className={`faq-item${isOpen ? " is-open" : ""}`} style={faqItemStyle}>
                  <button
                    type="button"
                    className="faq-summary-btn"
                    style={faqSummaryStyle}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                  >
                    <span style={faqIndexStyle}>{String(index + 1).padStart(2, "0")}</span>
                    {item.q}
                    <span className="faq-chevron" aria-hidden="true" style={{ marginLeft: "auto", fontFamily: "var(--font-display)" }}>
                      +
                    </span>
                  </button>
                  <div className="faq-panel" id={panelId} role="region">
                    <div className="faq-panel-inner">
                      <p style={{ marginTop: 10, marginLeft: 40, color: "var(--color-ink-muted)", lineHeight: 1.6, fontSize: 14 }}>
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
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

/**
 * Своя точка входа в scroll-reveal на каждую карточку (а не общий наблюдатель на
 * весь блок) — карточки реально появляются одна за другой по мере скролла, а не
 * вспыхивают все разом, как только верх секции коснулся вьюпорта.
 */
function StepCard({
  step,
  index,
}: {
  step: { scene: StepSceneKind; sceneLabel: string; title: string; text: string };
  index: number;
}) {
  const cardRef = useReveal<HTMLElement>();

  return (
    <article ref={cardRef} className="step-card">
      <div className="step-card-frame">
        <StepScene kind={step.scene} index={index} label={step.sceneLabel} />
      </div>
      <h3 style={{ fontSize: 19, marginBottom: 8 }}>
        <span className="sr-only">Шаг {index + 1}. </span>
        {step.title}
      </h3>
      <p style={{ fontSize: 14.5, color: "var(--color-ink-muted)", lineHeight: 1.6 }}>{step.text}</p>
    </article>
  );
}

/**
 * Связка между карточками — не статичная стрелка, а живой "пульс" из трёх точек,
 * бегущих слева направо (на мобильном — сверху вниз), тот же принцип, что и live-dot
 * у бейджа "Сейчас на витрине": короткий постоянный сигнал движения, а не одноразовый
 * въезд. Сама точка-хаб появляется через тот же useReveal, что и соседние карточки.
 */
function StepConnector() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="step-connector" aria-hidden="true">
      <span className="step-connector-dot" style={{ "--dot-delay": "0s" } as CSSProperties} />
      <span className="step-connector-dot" style={{ "--dot-delay": "0.2s" } as CSSProperties} />
      <span className="step-connector-dot" style={{ "--dot-delay": "0.4s" } as CSSProperties} />
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
