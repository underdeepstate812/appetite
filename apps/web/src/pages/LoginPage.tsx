import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { authActions, useAuth } from "../store/auth";
import { getReturnPath } from "../utils/returnPath";
import { formatRuPhoneInput, isValidEmail, isValidPhone } from "../utils/validation";
import { BackButton } from "../components/BackButton";
import { usePageTitle } from "../hooks/usePageTitle";

type LoginMode = "email" | "phone";

export function LoginPage() {
  usePageTitle("Вход — Appetite");
  const [mode, setMode] = useState<LoginMode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+7");
  const [password, setPassword] = useState("");
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
      await authActions.login({ identifier, password });
      navigate(getReturnPath(location), { replace: true });
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Не удалось войти");
    } finally {
      setSubmitting(false);
    }
  };

  // Уже вошёл (открыл /login по закладке или вернулся кнопкой "назад") — форма не нужна.
  if (user) return <Navigate to={getReturnPath(location)} replace />;

  return (
    <div className="auth-page">
      <BackButton />
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

          {import.meta.env.DEV ? (
            <p className="field-hint" style={{ textAlign: "center" }}>
              Демо-доступ: user@apetite.ru / password123
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
