import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import { rememberSession } from "../utils/session";
import { isValidEmail } from "../utils/validation";
import { IconBadge } from "../components/IconBadge";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const emailError = emailTouched && email.length > 0 && !isValidEmail(email) ? "Некорректный email" : null;
  const canSubmit = isValidEmail(email) && password.length > 0 && !submitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await authApi.login({ email, password });
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
            Вход выполнен. Сам сервис — в мобильном приложении Apetite, сайт пока только
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
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setEmailTouched(true)}
              className={emailError ? "field-invalid" : ""}
              autoComplete="email"
              required
            />
            {emailError ? <span className="field-error" role="alert">{emailError}</span> : null}
          </div>

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
