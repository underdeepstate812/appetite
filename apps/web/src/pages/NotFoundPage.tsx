import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

/** Неизвестный адрес: раньше сайт показывал шапку с пустой страницей без единого объяснения. */
export function NotFoundPage() {
  usePageTitle("Страница не найдена — Appetite");

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ textAlign: "center" }}>
        <p style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, color: "var(--color-primary)", marginBottom: 12 }} aria-hidden="true">
          404
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Такой страницы нет</h1>
        <p style={{ color: "var(--color-ink-muted)", fontSize: 14, marginBottom: 24 }}>
          Возможно, ссылка устарела или в адресе опечатка. Вернёмся на главную?
        </p>
        <Link to="/" className="btn btn-primary btn-block">
          На главную
        </Link>
      </div>
    </div>
  );
}
