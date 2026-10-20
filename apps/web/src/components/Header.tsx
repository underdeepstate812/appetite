import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../store/auth";
import { useAccountSummary } from "../hooks/useAccountSummary";
import { attentionCount } from "../utils/accountSummary";
import { AccountMenu, AccountSheet } from "./AccountMenu";
import { AppetiteMark } from "./AppetiteMark";

/** Гостю — лендинг: как это работает, бизнесу, вопросы. */
const GUEST_LINKS = [
  { href: "/home", label: "Витрина" },
  { href: "#how", label: "Как это работает" },
  { href: "/for-business", label: "Для бизнеса" },
  { href: "#faq", label: "Вопросы" },
];

/** Вошедшему лендинг и раздел для бизнеса не нужны (у заведений свой кабинет): только то, чем он пользуется как покупатель. */
const MEMBER_LINKS = [
  { href: "/home", label: "Витрина" },
  { href: "/orders", label: "Мои заказы" },
];

function NavLink({
  href,
  label,
  className,
  onClick,
  trailingIcon,
  isHome,
  current,
}: {
  href: string;
  label: string;
  className: string;
  onClick: () => void;
  trailingIcon?: boolean;
  isHome: boolean;
  /** Текущая страница — для подсветки и aria-current. */
  current?: boolean;
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
    <Link to={href} className={`${className}${current ? " is-current" : ""}`} onClick={onClick} aria-current={current ? "page" : undefined}>
      {content}
    </Link>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { user } = useAuth();
  const { summary, refresh } = useAccountSummary(user?.id ?? null);
  const links = user ? MEMBER_LINKS : GUEST_LINKS;
  const attention = attentionCount(summary);
  const isCurrent = (href: string) => !href.startsWith("#") && (location.pathname === href || location.pathname.startsWith(`${href}/`));

  // Меню — плавающая панель поверх контента, а не аккордеон в потоке страницы,
  // поэтому как у любого дропдауна должно закрываться кликом вне себя и по Esc (фокус возвращается на кнопку-бургер).
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideHeader = headerRef.current?.contains(target);
      const insidePanel = menuPanelRef.current?.contains(target);
      if (!insideHeader && !insidePanel) setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      burgerRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Любой переход (ссылка, «назад» в браузере, выход) закрывает панель; пока она открыта на телефоне, страница под ней не прокручивается.
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", menuOpen);
    if (menuOpen && user) refresh();
    return () => document.documentElement.classList.remove("menu-open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  return (
    <header ref={headerRef} className="site-header">
      <div className="container site-header-inner">
        <Link to={user ? "/home" : "/"} className="site-logo" onClick={() => setMenuOpen(false)}>
          <AppetiteMark size={26} /> Appetite
        </Link>

        <nav className="site-nav-desktop">
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} className="site-nav-link" onClick={() => {}} isHome={isHome} current={isCurrent(link.href)} />
          ))}
        </nav>

        <div className="site-header-actions">
          {user ? (
            <AccountMenu user={user} summary={summary} onOpen={refresh} />
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
            ref={burgerRef}
            className={`hamburger-btn${attention > 0 && !menuOpen ? " has-attention" : ""}`}
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
          <nav className="mobile-menu-inner" aria-label={user ? "Личный кабинет" : "Меню"}>
            {user ? (
              <AccountSheet user={user} summary={summary} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
            ) : (
              <>
                {GUEST_LINKS.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    className="mobile-menu-link"
                    onClick={() => setMenuOpen(false)}
                    trailingIcon
                    isHome={isHome}
                    current={isCurrent(link.href)}
                  />
                ))}
                <Link to="/login" className="mobile-menu-link" onClick={() => setMenuOpen(false)}>
                  <span>Войти</span>
                  <ArrowRight size={15} strokeWidth={2.2} className="mobile-menu-link-arrow" aria-hidden="true" />
                </Link>
              </>
            )}
          </nav>
        </div>,
        document.body
      )}
    </header>
  );
}
