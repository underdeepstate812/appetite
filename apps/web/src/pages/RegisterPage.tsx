import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Smartphone, CheckCircle2 } from "lucide-react";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { rememberSession } from "../utils/session";
import { formatRuPhoneInput, isValidEmail, isValidPhone, getPasswordError } from "../utils/validation";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";
import { IconBadge } from "../components/IconBadge";

const OTP_RESEND_COOLDOWN_SECONDS = 60;

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [phoneEnabled, setPhoneEnabled] = useState(false);
  const [phone, setPhone] = useState("+7");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const startCooldown = () => {
    setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const nameError = touched.name && name.trim().length < 2 ? "Минимум 2 символа" : null;
  const emailError = touched.email && email.length > 0 && !isValidEmail(email) ? "Некорректный email" : null;
  const passwordError = touched.password ? getPasswordError(password) : null;
  const confirmError =
    touched.confirmPassword && confirmPassword.length > 0 && confirmPassword !== password
      ? "Пароли не совпадают"
      : null;
  const phoneFormatError = touched.phone && phone.length > 0 && !isValidPhone(phone) ? "Некорректный номер" : null;

  const coreValid =
    name.trim().length >= 2 &&
    isValidEmail(email) &&
    getPasswordError(password) === null &&
    confirmPassword === password;
  const canSubmit = coreValid && (!phoneEnabled || phoneVerified) && !submitting;

  const handleSendCode = async () => {
    if (!isValidPhone(phone)) {
      setTouched((prev) => ({ ...prev, phone: true }));
      return;
    }
    setOtpBusy(true);
    setOtpError(null);
    try {
      await authApi.requestOtp({ phone });
      setOtpSent(true);
      startCooldown();
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : "Не удалось отправить код");
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const result = await authApi.verifyOtp({ phone, code: otpCode });
      if (result.verified) setPhoneVerified(true);
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : "Не удалось проверить код");
    } finally {
      setOtpBusy(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ name: true, email: true, password: true, confirmPassword: true, phone: true });
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const data = await authApi.register({
        name: name.trim(),
        email,
        password,
        phone: phoneEnabled && phoneVerified ? phone : undefined,
      });
      rememberSession(data.user, data);
      setDone(data.user.name);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Не удалось зарегистрироваться");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <IconBadge icon={CheckCircle2} size="xl" />
          <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 16 }}>Добро пожаловать, {done}!</h1>
          <p style={{ color: "var(--color-ink-muted)", marginTop: 10, lineHeight: 1.6 }}>
            Аккаунт создан{phoneEnabled && phoneVerified ? " и телефон подтверждён" : ""}. Сам
            сервис — в мобильном приложении Appetite, сайт пока только для входа/регистрации.
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
      <form className="card auth-card" onSubmit={(event) => void handleSubmit(event)}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Регистрация</h1>
        <p style={{ color: "var(--color-ink-muted)", fontSize: 14, marginBottom: 24 }}>
          Уже есть аккаунт?{" "}
          <Link to="/login" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
            Войти
          </Link>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label htmlFor="name">Имя</label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
              className={nameError ? "field-invalid" : ""}
              autoComplete="name"
              required
            />
            {nameError ? <span className="field-error" role="alert">{nameError}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              className={emailError ? "field-invalid" : ""}
              autoComplete="email"
              required
            />
            {emailError ? <span className="field-error" role="alert">{emailError}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="reg-password">Пароль</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              className={passwordError ? "field-invalid" : ""}
              autoComplete="new-password"
              required
            />
            {passwordError ? <span className="field-error" role="alert">{passwordError}</span> : <PasswordStrengthMeter password={password} />}
          </div>

          <div className="field">
            <label htmlFor="confirm-password">Повтори пароль</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
              className={confirmError ? "field-invalid" : ""}
              autoComplete="new-password"
              required
            />
            {confirmError ? <span className="field-error" role="alert">{confirmError}</span> : null}
          </div>

          {!phoneEnabled ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: "flex-start", paddingLeft: 0 }}
              onClick={() => setPhoneEnabled(true)}
            >
              <Smartphone size={16} aria-hidden="true" /> Подтвердить телефон по СМС (необязательно)
            </button>
          ) : (
            <div className="field" style={{ background: "var(--color-surface)", padding: 14, borderRadius: "var(--radius-sm)" }}>
              <label htmlFor="phone">Телефон</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(formatRuPhoneInput(event.target.value));
                    setPhoneVerified(false);
                    setOtpSent(false);
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                  className={phoneFormatError ? "field-invalid" : ""}
                  placeholder="+79991234567"
                  disabled={phoneVerified}
                  autoComplete="tel"
                />
                {!phoneVerified ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0 }}
                    disabled={otpBusy || cooldown > 0 || !isValidPhone(phone)}
                    onClick={() => void handleSendCode()}
                  >
                    {cooldown > 0 ? `${cooldown}с` : otpSent ? "Ещё раз" : "Код"}
                  </button>
                ) : null}
              </div>
              {phoneFormatError ? <span className="field-error" role="alert">{phoneFormatError}</span> : null}

              {phoneVerified ? (
                <p style={{ color: "var(--color-primary)", fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                  ✓ Телефон подтверждён
                </p>
              ) : otpSent ? (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Код из СМС"
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ flexShrink: 0 }}
                    disabled={otpBusy || otpCode.length !== 6}
                    onClick={() => void handleVerifyCode()}
                  >
                    Проверить
                  </button>
                </div>
              ) : null}
              {otpError ? <span className="field-error" role="alert">{otpError}</span> : null}
            </div>
          )}

          {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}

          <button className="btn btn-primary btn-block" type="submit" disabled={!canSubmit}>
            {submitting ? "Создаём аккаунт..." : "Зарегистрироваться"}
          </button>
        </div>
      </form>
    </div>
  );
}
