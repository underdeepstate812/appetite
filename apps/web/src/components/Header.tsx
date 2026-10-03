import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, LogOut, Receipt } from "lucide-react";
import { authActions, useAuth } from "../store/auth";
import { AppetiteMark } from "./AppetiteMark";

const NAV_LINKS = [
  { href: "/map", label: "Карта" },
  { href: "#how", label: "Как это работает" },
  { href: "/for-business", label: "Для бизнеса" },
  { href: "#faq", label: "Вопросы" },
];

function NavLink({
  href,
  label,
  className,
  onClick,
  trailingIcon,
  isHome,
}: {
  href: string;
  label: string;
  className: string;
  onClick: () => void;
  trailingIcon?: boolean;
  isHome: boolean;
}) {
  const content = (
    <>
      <span>{label}</span>
      {trailingIcon ? (
        <ArrowRight size={15} strokeWidth={2.2} className="mobile-menu-link-arrow" aria-hidden="true" />
      ) : null}
    </>
  );

  if (href.startsWith("#")) {
    // Якоря (#how, #faq) существуют только на LandingPage — с любой другой страницы
    // обычный <a href="#faq"> просто не срабатывает (секции с таким id на текущей
    // странице нет). Уходим на "/#faq": Layout сам доскроллит после перехода.
    if (!isHome) {
      return (
        <Link to={`/${href}`} className={className} onClick={onClick}>
          {content}
        </Link>
      );
    }
    return (
      <a href={href} className={className} onClick={onClick}>
        {content}
      </a>
    );
  }
  return (
    <Link to={href} className={className} onClick={onClick}>
      {content}
    </Link>
  );
}

/** Меню вошедшего пользователя: имя в шапке открывает «Мои заказы» и «Выйти». */
function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-menu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="user-menu-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="user-menu-name">{name}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div className="user-menu-panel" role="menu">
          <Link to="/orders" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
            <Receipt size={16} aria-hidden="true" /> Мои заказы
          </Link>
          <button
            type="button"
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              setOpen(false);
              void authActions.logout().then(() => navigate("/", { replace: true }));
            }}
          >
            <LogOut size={16} aria-hidden="true" /> Выйти
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { user } = useAuth();
  const navigate = useNavigate();

  // Меню — плавающая панель поверх контента, а не аккордеон в потоке страницы,
  // поэтому как у любого дропдауна должно закрываться кликом вне себя и по Esc.
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideHeader = headerRef.current?.contains(target);
      const insidePanel = menuPanelRef.current?.contains(target);
      if (!insideHeader && !insidePanel) setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header ref={headerRef} className="site-header">
      <div className="container site-header-inner">
        <Link to="/" className="site-logo" onClick={() => setMenuOpen(false)}>
          <AppetiteMark size={26} /> Appetite
        </Link>

        <nav className="site-nav-desktop">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} className="site-nav-link" onClick={() => {}} isHome={isHome} />
          ))}
        </nav>

        <div className="site-header-actions">
          {user ? (
            <UserMenu name={user.name} />
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm btn-desktop-only">
                Войти
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Регистрация
                <ArrowRight size={15} strokeWidth={2.4} className="btn-arrow" aria-hidden="true" />
              </Link>
            </>
          )}
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

      {/* Портал в body, а не дочерний элемент <header> — иначе собственный
          backdrop-filter хедера ломает композитинг вложенного backdrop-filter
          панели в Chromium (подтверждено экспериментально: с blur на хедере
          стекло меню теряет непрозрачность и текст страницы просвечивает). */}
      {createPortal(
        <div ref={menuPanelRef} className={`mobile-menu ${menuOpen ? "is-open" : ""}`}>
          <nav className="mobile-menu-inner">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                className="mobile-menu-link"
                onClick={() => setMenuOpen(false)}
                trailingIcon
                isHome={isHome}
              />
            ))}
            {user ? (
              <>
                <Link to="/orders" className="mobile-menu-link" onClick={() => setMenuOpen(false)}>
                  <span>Мои заказы</span>
                  <ArrowRight size={15} strokeWidth={2.2} className="mobile-menu-link-arrow" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  className="mobile-menu-link"
                  onClick={() => {
                    setMenuOpen(false);
                    void authActions.logout().then(() => navigate("/", { replace: true }));
                  }}
                >
                  <span>Выйти</span>
                  <LogOut size={15} strokeWidth={2.2} className="mobile-menu-link-arrow" aria-hidden="true" />
                </button>
              </>
            ) : (
              <Link to="/login" className="mobile-menu-link" onClick={() => setMenuOpen(false)}>
                <span>Войти</span>
                <ArrowRight size={15} strokeWidth={2.2} className="mobile-menu-link-arrow" aria-hidden="true" />
              </Link>
            )}
          </nav>
        </div>,
        document.body
      )}
    </header>
  );
}
