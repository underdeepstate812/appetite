import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { rememberSession } from "../utils/session";
import { formatRuPhoneInput, isValidEmail, isValidPhone } from "../utils/validation";
import { IconBadge } from "../components/IconBadge";

type LoginMode = "email" | "phone";

export function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+7");
  const [password, setPassword] = useState("");
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const identifier = mode === "email" ? email : phone;
  const identifierValid = mode === "email" ? isValidEmail(email) : isValidPhone(phone);
  const identifierError =
    identifierTouched && identifier.length > 0 && !identifierValid
      ? mode === "email"
        ? "Некорректный email"
        : "Формат: +7XXXXXXXXXX"
      : null;
  const canSubmit = identifierValid && password.length > 0 && !submitting;

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setIdentifierTouched(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await authApi.login({ identifier, password });
      rememberSession(data.user, data);
      setDone(data.user.name);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Не удалось войти");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <IconBadge icon={CheckCircle2} size="xl" />
          <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 16 }}>С возвращением, {done}!</h1>
          <p style={{ color: "var(--color-ink-muted)", marginTop: 10, lineHeight: 1.6 }}>
            Вход выполнен. Сам сервис — в мобильном приложении Appetite, сайт пока только
            для входа/регистрации.
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
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Вход</h1>
        <p style={{ color: "var(--color-ink-muted)", fontSize: 14, marginBottom: 24 }}>
          Ещё нет аккаунта?{" "}
          <Link to="/register" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
            Зарегистрируйся
          </Link>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="ribbon-filters" role="tablist" aria-label="Способ входа" style={{ alignSelf: "flex-start" }}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "email"}
              className={`ribbon-filter${mode === "email" ? " is-active" : ""}`}
              onClick={() => switchMode("email")}
            >
              Email
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "phone"}
              className={`ribbon-filter${mode === "phone" ? " is-active" : ""}`}
              onClick={() => switchMode("phone")}
            >
              Телефон
            </button>
          </div>

          {mode === "email" ? (
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setIdentifierTouched(true)}
                className={identifierError ? "field-invalid" : ""}
                autoComplete="email"
                required
              />
              {identifierError ? <span className="field-error" role="alert">{identifierError}</span> : null}
            </div>
          ) : (
            <div className="field">
              <label htmlFor="phone">Телефон</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(formatRuPhoneInput(event.target.value))}
                onBlur={() => setIdentifierTouched(true)}
                className={identifierError ? "field-invalid" : ""}
                autoComplete="tel"
                placeholder="+79991234567"
                required
              />
              {identifierError ? <span className="field-error" role="alert">{identifierError}</span> : null}
            </div>
          )}

          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="btn btn-primary btn-block" type="submit" disabled={!canSubmit}>
            {submitting ? "Входим..." : "Войти"}
          </button>

          <p className="field-hint" style={{ textAlign: "center" }}>
            Демо-доступ: user@apetite.ru / password123
          </p>
        </div>
      </form>
    </div>
  );
}
