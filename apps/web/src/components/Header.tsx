import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AppetiteMark } from "./AppetiteMark";

const NAV_LINKS = [
  { href: "#how", label: "Как это работает" },
  { href: "/for-business", label: "Для бизнеса" },
  { href: "#faq", label: "Вопросы" },
];

function NavLink({ href, label, className, onClick }: { href: string; label: string; className: string; onClick: () => void }) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <Link to={href} className={className} onClick={onClick}>
      {label}
    </Link>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link to="/" className="site-logo" onClick={() => setMenuOpen(false)}>
          <AppetiteMark size={26} /> Appetite
        </Link>

        <nav className="site-nav-desktop">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} className="site-nav-link" onClick={() => {}} />
          ))}
        </nav>

        <div className="site-header-actions">
          <Link to="/login" className="btn btn-ghost btn-sm btn-desktop-only">
            Войти
          </Link>
          <Link to="/register" className="btn btn-primary btn-sm">
            Регистрация
            <ArrowRight size={15} strokeWidth={2.4} className="btn-arrow" aria-hidden="true" />
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
        <nav className="mobile-menu-inner">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              className="mobile-menu-link"
              onClick={() => setMenuOpen(false)}
            />
          ))}
          <Link to="/login" className="mobile-menu-link" onClick={() => setMenuOpen(false)}>
            Войти
          </Link>
        </nav>
      </div>
    </header>
  );
}
