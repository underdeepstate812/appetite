import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AppetiteMark } from "./AppetiteMark";

const NAV_LINKS = [
  { href: "#how", label: "Как это работает" },
  { href: "/for-business", label: "Для бизнеса" },
  { href: "#faq", label: "Вопросы" },
];

function NavLink({
  href,
  label,
  className,
  onClick,
  onMouseEnter,
}: {
  href: string;
  label: string;
  className: string;
  onClick: () => void;
  onMouseEnter?: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className} onClick={onClick} onMouseEnter={onMouseEnter}>
        {label}
      </a>
    );
  }
  return (
    <Link to={href} className={className} onClick={onClick} onMouseEnter={onMouseEnter}>
      {label}
    </Link>
  );
}

/* Позиция и ширина капсулы читаются с самой наведённой ссылки (getBoundingClientRect),
   а не захардкожены — значит верстка/лейбл может меняться, а подсветка всегда точно
   обведёт нужный пункт. Тот же "магнитный" приём, что и у фокуса в macOS/tvOS: не
   плоское подчёркивание, а один объект, который плавно переезжает между стоп-точками. */
type Highlight = { left: number; width: number; opacity: number };

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [highlight, setHighlight] = useState<Highlight>({ left: 0, width: 0, opacity: 0 });

  const moveHighlight = (event: ReactMouseEvent<HTMLElement>) => {
    const nav = navRef.current;
    if (!nav) return;
    const navBox = nav.getBoundingClientRect();
    const linkBox = event.currentTarget.getBoundingClientRect();
    setHighlight({ left: linkBox.left - navBox.left, width: linkBox.width, opacity: 1 });
  };

  const hideHighlight = () => setHighlight((prev) => ({ ...prev, opacity: 0 }));

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link to="/" className="site-logo" onClick={() => setMenuOpen(false)}>
          <AppetiteMark size={26} /> Appetite
        </Link>

        <nav ref={navRef} className="site-nav-desktop" onMouseLeave={hideHighlight}>
          <span
            className="site-nav-highlight"
            style={{ transform: `translateX(${highlight.left}px)`, width: highlight.width, opacity: highlight.opacity }}
            aria-hidden="true"
          />
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              className="site-nav-link"
              onClick={() => {}}
              onMouseEnter={moveHighlight}
            />
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
            {/* Три полосы никогда не размонтируются — открытие/закрытие это одна и та
                же тройка span'ов, которая переезжает/вращается в крест и обратно, а не
                подмена одной картинки на другую без перехода. */}
            <span className={`hamburger-icon ${menuOpen ? "is-open" : ""}`} aria-hidden="true">
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </span>
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
