import { useState } from "react";
import { Link } from "react-router-dom";
import { AppetiteMark } from "./AppetiteMark";

const NAV_LINKS = [
  { href: "#how", label: "Как это работает" },
  { href: "#business", label: "Для заведений" },
  { href: "#faq", label: "Вопросы" },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link to="/" className="site-logo" onClick={() => setMenuOpen(false)}>
          <AppetiteMark size={26} /> Apetite
        </Link>

        <nav className="site-nav-desktop">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="site-nav-link">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="site-header-actions">
          <Link to="/login" className="btn btn-ghost btn-sm btn-desktop-only">
            Войти
          </Link>
          <Link to="/register" className="btn btn-primary btn-sm">
            Регистрация
          </Link>
          <button
            className="hamburger-btn"
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
              {menuOpen ? (
                <path
                  d="M1 1 L19 15 M19 1 L1 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  <line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="0" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="0" y1="15" x2="20" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className={`mobile-menu ${menuOpen ? "is-open" : ""}`}>
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="mobile-menu-link" onClick={() => setMenuOpen(false)}>
            {link.label}
          </a>
        ))}
        <Link to="/login" className="mobile-menu-link" onClick={() => setMenuOpen(false)}>
          Войти
        </Link>
      </div>
    </header>
  );
}
