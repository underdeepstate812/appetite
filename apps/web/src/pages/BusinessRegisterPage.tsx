import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { OfferCategory } from "@apetite/shared";
import { businessApplicationsApi } from "../api/businessApplications";
import { ApiError } from "../api/client";
import { formatRuPhoneInput, isValidEmail, isValidPhone } from "../utils/validation";
import { IconBadge } from "../components/IconBadge";

const CATEGORY_LABELS: Record<OfferCategory, string> = {
  [OfferCategory.FOOD]: "Кафе / ресторан",
  [OfferCategory.BAKERY]: "Пекарня / кондитерская",
  [OfferCategory.FLOWERS]: "Цветочный магазин",
  [OfferCategory.GROCERIES]: "Продуктовый магазин",
};

export function BusinessRegisterPage() {
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
          <IconBadge icon={CheckCircle2} size="xl" />
          <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 16 }}>Заявка отправлена!</h1>
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
    <div className="auth-page">
      <form className="card auth-card" style={{ maxWidth: 460 }} onSubmit={(event) => void handleSubmit(event)}>
        <span className="stamp">Для бизнеса</span>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 12, marginBottom: 6 }}>Подключить заведение</h1>
        <p style={{ color: "var(--color-ink-muted)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          Оставь заявку — мы свяжемся, поможем настроить офферы и дадим доступ в панель бизнеса.
          Комиссия платформы фиксированная — 25% с завершённых заказов.
        </p>

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
            <select id="biz-category" value={category} onChange={(event) => setCategory(event.target.value as OfferCategory)}>
              {Object.values(OfferCategory).map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
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

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.5, cursor: "pointer" }}>
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
  );
}
