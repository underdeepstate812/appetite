import { useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, Handshake, PenLine, Settings2 } from "lucide-react";
import { OfferCategory } from "@apetite/shared";
import { businessApplicationsApi } from "../api/businessApplications";
import { ApiError } from "../api/client";
import { formatRuPhoneInput, isValidEmail, isValidPhone } from "../utils/validation";
import { Select } from "../components/Select";
import { Stamp } from "../components/Stamp";
import { BackButton } from "../components/BackButton";
import { useReveal } from "../hooks/useReveal";
import { useCountUp } from "../hooks/useCountUp";
import { usePageTitle } from "../hooks/usePageTitle";

const CATEGORY_LABELS: Record<OfferCategory, string> = {
  [OfferCategory.FOOD]: "Кафе / ресторан",
  [OfferCategory.BAKERY]: "Пекарня / кондитерская",
  [OfferCategory.FLOWERS]: "Цветочный магазин",
  [OfferCategory.GROCERIES]: "Продуктовый магазин",
};

const CATEGORY_OPTIONS = Object.values(OfferCategory).map((value) => ({ value, label: CATEGORY_LABELS[value] }));

const STEPS = [
  { n: "01", icon: PenLine, text: "Оставляешь заявку — название, адрес, контакты" },
  { n: "02", icon: Handshake, text: "Мы звоним в течение рабочего дня и подключаем" },
  { n: "03", icon: Settings2, text: "Настраиваешь офферы и скидку — и уже работаешь" },
];

const UNBOUNDED: CSSProperties = { fontFamily: '"Unbounded", var(--font-display)' };

export function BusinessRegisterPage() {
  usePageTitle("Для бизнеса — Appetite");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<OfferCategory>(OfferCategory.FOOD);
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("+7");
  const [ofertaAccepted, setOfertaAccepted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [panelInView, setPanelInView] = useState(false);
  const panelRef = useReveal<HTMLDivElement>(() => setPanelInView(true));
  const formRef = useReveal<HTMLFormElement>();
  const discountCount = useCountUp(25, panelInView, 1000);
  const commissionCount = useCountUp(25, panelInView, 1000);

  const nameError = touched.name && name.trim().length < 2 ? "Минимум 2 символа" : null;
  const addressError = touched.address && address.trim().length < 5 ? "Укажи полный адрес" : null;
  const contactNameError = touched.contactName && contactName.trim().length < 2 ? "Минимум 2 символа" : null;
  const emailError =
    touched.contactEmail && contactEmail.length > 0 && !isValidEmail(contactEmail) ? "Некорректный email" : null;
  const phoneError =
    touched.contactPhone && contactPhone.length > 0 && !isValidPhone(contactPhone)
      ? "Формат: +7XXXXXXXXXX"
      : null;

  const canSubmit =
    name.trim().length >= 2 &&
    address.trim().length >= 5 &&
    contactName.trim().length >= 2 &&
    isValidEmail(contactEmail) &&
    isValidPhone(contactPhone) &&
    ofertaAccepted &&
    !submitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ name: true, address: true, contactName: true, contactEmail: true, contactPhone: true });
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await businessApplicationsApi.create({
        name: name.trim(),
        category,
        address: address.trim(),
        contactName: contactName.trim(),
        contactEmail,
        contactPhone,
        ofertaAccepted,
      });
      setDone(true);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Не удалось отправить заявку");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Stamp icon={Check} label="Принято" size={110} />
          </div>
          <h1 style={{ ...UNBOUNDED, fontSize: 24, fontWeight: 800, marginTop: 20, lineHeight: 1.25 }}>
            Заявка отправлена!
          </h1>
          <p style={{ color: "var(--color-ink-muted)", marginTop: 10, lineHeight: 1.6 }}>
            Мы свяжемся с тобой в течение рабочего дня, чтобы подключить заведение и настроить
            панель бизнеса.
          </p>
          <Link to="/" className="btn btn-primary btn-block" style={{ marginTop: 24 }}>
            На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "48px 0 96px" }}>
      <div className="container" style={{ marginBottom: 4 }}>
        <BackButton />
      </div>
      <div className="container" style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
        {/* Манифест: почему стоит подключиться — цифры и шаги, не форма. */}
        <div
          ref={panelRef}
          className="reveal grain-panel"
          style={{
            flex: "1 1 420px",
            position: "relative",
            overflow: "hidden",
            background: "var(--color-ink)",
            borderRadius: "var(--radius-lg)",
            padding: "44px 36px",
            color: "var(--color-background)",
          }}
        >
          <Stamp
            icon={Handshake}
            label="Партнёр"
            sublabel="Appetite"
            tone="onDark"
            size={108}
            // Печать "наезжает" на угол панели — как оттиск на письме, а не приклеенная иконка.
            style={{ position: "absolute", top: -14, right: 18 }}
          />

          <span className="eyebrow" style={{ color: "var(--color-primary-soft)" }}>
            Для бизнеса
          </span>
          <h1
            style={{
              ...UNBOUNDED,
              fontSize: "clamp(32px, 4vw, 44px)",
              fontWeight: 800,
              lineHeight: 1.08,
              marginTop: 14,
              maxWidth: 360,
            }}
          >
            Твоя витрина —{" "}
            <span style={{ color: "var(--color-primary-soft)", fontStyle: "italic" }}>
              рядом с голодным Петербургом
            </span>
          </h1>

          <div style={{ display: "flex", gap: 32, marginTop: 36, flexWrap: "wrap" }}>
            <div>
              <p style={{ ...UNBOUNDED, fontSize: 34, fontWeight: 800, color: "var(--color-primary-soft)" }}>
                {discountCount}–70%
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,253,249,0.68)", marginTop: 4, maxWidth: 160, lineHeight: 1.5 }}>
                скидка — стартовую ставишь сам
              </p>
            </div>
            <div>
              <p style={{ ...UNBOUNDED, fontSize: 34, fontWeight: 800, color: "var(--color-primary-soft)" }}>
                {commissionCount}%
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,253,249,0.68)", marginTop: 4, maxWidth: 160, lineHeight: 1.5 }}>
                агентское вознаграждение (без учёта НДС), без сюрпризов
              </p>
            </div>
            <div>
              <p style={{ ...UNBOUNDED, fontSize: 34, fontWeight: 800, color: "var(--color-primary-soft)" }}>0 ₽</p>
              <p style={{ fontSize: 13, color: "rgba(255,253,249,0.68)", marginTop: 4, maxWidth: 160, lineHeight: 1.5 }}>
                первые 20–30 дней — подключение и комиссия бесплатно
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 40 }}>
            {STEPS.map((step) => (
              <div key={step.n} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "1.5px solid rgba(255,253,249,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <step.icon size={17} strokeWidth={1.8} color="var(--color-primary-soft)" />
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(255,253,249,0.85)" }}>
                  <span style={{ ...UNBOUNDED, color: "var(--color-primary-soft)", marginRight: 8 }}>{step.n}</span>
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Сама форма заявки. */}
        <form
          ref={formRef}
          className="reveal card"
          style={{ flex: "1 1 380px", padding: "36px 32px" }}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <span className="eyebrow">Заявка на подключение</span>
          <h2 style={{ ...UNBOUNDED, fontSize: 22, fontWeight: 800, marginTop: 10, marginBottom: 22, lineHeight: 1.3 }}>
            Подключить заведение
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label htmlFor="biz-name">Название заведения</label>
            <input
              id="biz-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
              className={nameError ? "field-invalid" : ""}
              required
            />
            {nameError ? <span className="field-error" role="alert">{nameError}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="biz-category">Категория</label>
            <Select id="biz-category" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
          </div>

          <div className="field">
            <label htmlFor="biz-address">Адрес</label>
            <input
              id="biz-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, address: true }))}
              className={addressError ? "field-invalid" : ""}
              placeholder="Санкт-Петербург, Невский проспект, 1"
              required
            />
            {addressError ? <span className="field-error" role="alert">{addressError}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="biz-contact-name">Контактное лицо</label>
            <input
              id="biz-contact-name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, contactName: true }))}
              className={contactNameError ? "field-invalid" : ""}
              required
            />
            {contactNameError ? <span className="field-error" role="alert">{contactNameError}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="biz-email">Email</label>
            <input
              id="biz-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, contactEmail: true }))}
              className={emailError ? "field-invalid" : ""}
              required
            />
            {emailError ? <span className="field-error" role="alert">{emailError}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="biz-phone">Телефон</label>
            <input
              id="biz-phone"
              type="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(formatRuPhoneInput(event.target.value))}
              onBlur={() => setTouched((prev) => ({ ...prev, contactPhone: true }))}
              className={phoneError ? "field-invalid" : ""}
              placeholder="+79991234567"
              required
            />
            {phoneError ? <span className="field-error" role="alert">{phoneError}</span> : null}
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 13,
              lineHeight: 1.5,
              cursor: "pointer",
              background: "var(--color-surface)",
              borderRadius: "var(--radius-sm)",
              padding: 14,
            }}
          >
            <input
              type="checkbox"
              checked={ofertaAccepted}
              onChange={(event) => setOfertaAccepted(event.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
              required
            />
            <span>
              Я принимаю условия{" "}
              <Link to="/legal/oferta" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                публичной оферты
              </Link>{" "}
              и согласен(-на) с комиссией платформы 25% с заказов.
            </span>
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="btn btn-primary btn-block" type="submit" disabled={!canSubmit}>
            {submitting ? "Отправляем..." : "Отправить заявку"}
          </button>
          </div>
        </form>
      </div>
    </div>
  );
}
