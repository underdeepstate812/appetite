import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, LogOut, Receipt, Settings2, Store, Zap } from "lucide-react";
import type { User } from "@apetite/shared";
import { resolveAssetUrl } from "../api/client";
import { authActions } from "../store/auth";
import { hasOneClickConsent, revokeOneClickConsent } from "../utils/paymentPrefs";
import { accountContact, attentionCount, summaryCaption, type AccountSummary } from "../utils/accountSummary";

/** Согласие на «заказ в 1 клик»: читается при открытии меню (его могли выдать на витрине), снимается прямо из кабинета. */
function useOneClick(refreshKey: unknown) {
  const [enabled, setEnabled] = useState(hasOneClickConsent);
  useEffect(() => setEnabled(hasOneClickConsent()), [refreshKey]);
  return {
    enabled,
    disable: () => {
      revokeOneClickConsent();
      setEnabled(false);
    },
  };
}

function Avatar({ user, className }: { user: Pick<User, "name" | "avatarUrl">; className: string }) {
  const [failed, setFailed] = useState(false);
  const uri = resolveAssetUrl(user.avatarUrl);
  useEffect(() => setFailed(false), [uri]);
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";
  return uri && !failed ? <img className={`${className} is-photo`} src={uri} alt="" onError={() => setFailed(true)} /> : <span className={className} aria-hidden="true">{initial}</span>;
}

function Identity({ user, attention }: { user: Pick<User, "name" | "email" | "phone" | "avatarUrl">; attention: number }) {
  return (
    <div className="account-identity">
      <span className="account-avatar-wrap">
        <Avatar user={user} className="account-avatar" />
        {attention > 0 ? <i className="account-avatar-dot" /> : null}
      </span>
      <span className="account-who">
        <strong className="account-name">{user.name}</strong>
        <span className="account-contact">{accountContact(user)}</span>
      </span>
    </div>
  );
}

function OrdersBadge({ summary }: { summary: AccountSummary }) {
  const count = attentionCount(summary);
  return count > 0 ? (
    <span className="account-badge" aria-label={`Требуют внимания: ${count}`}>
      {count}
    </span>
  ) : null;
}

/** Выход единым образом для обоих меню: чистим сессию и возвращаем на главную. */
function useSignOut() {
  const navigate = useNavigate();
  return () => void authActions.logout().then(() => navigate("/", { replace: true }));
}

interface MenuProps {
  user: Pick<User, "name" | "email" | "phone" | "avatarUrl">;
  summary: AccountSummary;
  onOpen: () => void;
}

/**
 * Личное меню в шапке (десктоп): кто вошёл, что требует внимания, заказы, «заказ в 1 клик», выход.
 * Только покупательские вещи — разделы для бизнеса сюда не относятся (у заведений свой кабинет). Клавиатура — по паттерну меню:
 * при открытии фокус на первом пункте, стрелки/Home/End ходят по пунктам, Esc закрывает и возвращает фокус на кнопку.
 */
export function AccountMenu({ user, summary, onOpen }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const oneClick = useOneClick(open);
  const signOut = useSignOut();
  const caption = summaryCaption(summary);
  const attention = attentionCount(summary);

  useEffect(() => {
    if (!open) return;
    onOpen();
    panelRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) return;
    if (event.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      items[(next + items.length) % items.length].focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(items.length - 1);
    else if (event.key === "Tab") setOpen(false);
  };

  return (
    <div className="user-menu" ref={rootRef} onKeyDown={onKeyDown}>
      <button ref={buttonRef} type="button" className="user-menu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="user-menu-avatar-wrap">
          <Avatar user={user} className="user-menu-avatar" />
          {attention > 0 ? <i className="account-avatar-dot" /> : null}
        </span>
        <span className="user-menu-name">{user.name}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div className="user-menu-panel account-panel" role="menu" ref={panelRef} aria-label="Личный кабинет">
          <Identity user={user} attention={attention} />
          <Link to="/profile" role="menuitem" className="user-menu-item account-item" onClick={() => setOpen(false)}>
            <Settings2 size={17} aria-hidden="true" />
            <span className="account-item-text">
              Профиль и настройки
              <small>Данные, фото, тема оформления</small>
            </span>
          </Link>
          <Link to="/orders" role="menuitem" className="user-menu-item account-item" onClick={() => setOpen(false)}>
            <Receipt size={17} aria-hidden="true" />
            <span className="account-item-text">
              Мои заказы
              {caption ? <small>{caption}</small> : null}
            </span>
            <OrdersBadge summary={summary} />
          </Link>
          {oneClick.enabled ? (
            <button type="button" role="menuitem" className="user-menu-item account-item" onClick={oneClick.disable}>
              <Zap size={17} aria-hidden="true" />
              <span className="account-item-text">
                Отключить заказ в 1 клик
                <small>Сейчас оплата проходит одним нажатием</small>
              </span>
            </button>
          ) : null}
          <div className="account-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="user-menu-item account-item is-quiet"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            <LogOut size={17} aria-hidden="true" />
            <span className="account-item-text">Выйти</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Содержимое мобильной панели для вошедшего: то же личное меню, но крупно и без лендинговых ссылок. */
export function AccountSheet({ user, summary, open, onNavigate }: { user: MenuProps["user"]; summary: AccountSummary; open: boolean; onNavigate: () => void }) {
  const oneClick = useOneClick(open);
  const signOut = useSignOut();
  const caption = summaryCaption(summary);

  return (
    <>
      <Identity user={user} attention={attentionCount(summary)} />
      <Link to="/home" className="mobile-menu-link" onClick={onNavigate}>
        <span className="account-sheet-label">
          <Store size={18} aria-hidden="true" /> Витрина
        </span>
        <ArrowRight size={15} strokeWidth={2.2} className="mobile-menu-link-arrow" aria-hidden="true" />
      </Link>
      <Link to="/profile" className="mobile-menu-link" onClick={onNavigate}>
        <span className="account-sheet-label">
          <Settings2 size={18} aria-hidden="true" />
          <span>
            Профиль и настройки
            <small className="account-sheet-caption">Данные, фото, тема оформления</small>
          </span>
        </span>
      </Link>
      <Link to="/orders" className="mobile-menu-link" onClick={onNavigate}>
        <span className="account-sheet-label">
          <Receipt size={18} aria-hidden="true" />
          <span>
            Мои заказы
            {caption ? <small className="account-sheet-caption">{caption}</small> : null}
          </span>
        </span>
        <OrdersBadge summary={summary} />
      </Link>
      {oneClick.enabled ? (
        <button type="button" className="mobile-menu-link" onClick={oneClick.disable}>
          <span className="account-sheet-label">
            <Zap size={18} aria-hidden="true" />
            <span>
              Отключить заказ в 1 клик
              <small className="account-sheet-caption">Сейчас оплата проходит одним нажатием</small>
            </span>
          </span>
        </button>
      ) : null}
      <div className="account-sep" role="separator" />
      <button
        type="button"
        className="mobile-menu-link is-quiet"
        onClick={() => {
          onNavigate();
          signOut();
        }}
      >
        <span className="account-sheet-label">
          <LogOut size={18} aria-hidden="true" /> Выйти
        </span>
      </button>
    </>
  );
}
