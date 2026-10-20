import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const [email, setEmail] = useState(import.meta.env.DEV ? "cafe.pushkin@apetite.ru" : "");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login({ identifier: email, password });
      const role = useAuthStore.getState().user?.role;
      navigate(role === "ADMIN" ? "/platform/businesses" : "/offers", { replace: true });
    } catch {
      // ошибка уже в authStore.error
    }
  };

  return (
    <div style={wrapperStyle}>
      <form onSubmit={(event) => void handleSubmit(event)} className="card stack" style={{ width: 360, padding: 32, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-primary)" }}>Appetite</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 4 }}>Вход для бизнеса и платформы</p>
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={isLoading} style={{ marginTop: 4 }}>
          {isLoading ? "Входим..." : "Войти"}
        </button>

        {import.meta.env.DEV ? (
          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            Демо-доступ: cafe.pushkin@apetite.ru (бизнес) или admin@apetite.ru (платформа) / password123
          </p>
        ) : null}
      </form>
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-surface)",
};
