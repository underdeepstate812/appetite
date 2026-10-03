import type { ReactNode } from "react";

/**
 * Бейджи магазинов приложений в классической компоновке: чёрная плашка, знак магазина слева, две строки
 * текста. Нарисованы здесь, а не взяты как официальные картинки: когда приложение опубликуют, их заменят на
 * официальные бейджи с ссылками на страницы в магазинах (см. VITE_APP_STORE_URL / VITE_GOOGLE_PLAY_URL).
 */

const APPLE_PATH =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={APPLE_PATH} fill="#fff" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <polygon points="4,2 12,12 4,22" fill="#00a0ff" />
      <polygon points="4,2 12,12 14.5,8.2" fill="#00e375" />
      <polygon points="4,22 12,12 14.5,15.8" fill="#ff3a44" />
      <polygon points="12,12 14.5,8.2 21,12 14.5,15.8" fill="#ffd900" />
    </svg>
  );
}

interface BadgeProps {
  /** Ссылка на страницу приложения в магазине. Пока её нет (приложение не опубликовано) — бейдж неактивен. */
  href?: string;
  storeName: string;
  mark: ReactNode;
  kicker: string;
  name: string;
}

function StoreBadge({ href, storeName, mark, kicker, name }: BadgeProps) {
  const inner = (
    <>
      <span className="store-badge-mark">{mark}</span>
      <span className="store-badge-text">
        <span className="store-badge-kicker">{kicker}</span>
        <span className="store-badge-name">{name}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a className="store-badge" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${kicker} ${name}`}>
        {inner}
      </a>
    );
  }
  // Как «Блог» в футере: неактивная заглушка без перехода, а не ссылка в никуда.
  return (
    <button type="button" className="store-badge is-soon" aria-disabled="true" title={`${storeName}: скоро`} aria-label={`${name} — скоро`}>
      {inner}
    </button>
  );
}

export function AppStoreBadge({ href }: { href?: string }) {
  return <StoreBadge href={href} storeName="App Store" mark={<AppleMark />} kicker="Загрузите в" name="App Store" />;
}

export function GooglePlayBadge({ href }: { href?: string }) {
  return <StoreBadge href={href} storeName="Google Play" mark={<PlayMark />} kicker="Доступно в" name="Google Play" />;
}
