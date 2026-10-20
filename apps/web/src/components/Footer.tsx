import { AppetiteMark } from "./AppetiteMark";
import { AppQr } from "./AppQr";
import { AppStoreBadge, GooglePlayBadge } from "./StoreBadges";
import { useAuth } from "../store/auth";

/**
 * Ссылки на приложение задаются переменными окружения, чтобы подставить их при публикации без правки кода.
 * QR по умолчанию открывает веб-версию на телефоне (карта предложений): это работает уже сейчас, пока
 * приложения нет в магазинах; бейджи без ссылок остаются неактивными.
 */
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL as string | undefined;
const GOOGLE_PLAY_URL = import.meta.env.VITE_GOOGLE_PLAY_URL as string | undefined;

function appLink(): string {
  return (import.meta.env.VITE_APP_DOWNLOAD_URL as string | undefined) || `${window.location.origin}${BASE}/home`;
}

/** Приложение может жить не в корне домена (GitHub Pages: /appetite/web/) — обычные <a> обязаны учитывать базовый путь. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Footer() {
  const { user } = useAuth();
  return (
    <footer className="site-footer grain-panel">
      <span className="footer-ghost-mark" aria-hidden="true">
        Appetite
      </span>
      <div className="container footer-grid">
        <div>
          <p className="footer-logo" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AppetiteMark size={24} /> Appetite
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
            Вкусная еда, выпечка, цветы и продукты со скидкой 25–70% от заведений
            в твоём городе. Пилот — Санкт-Петербург.
          </p>
        </div>
        <div>
          <p className="footer-col-title">Продукт</p>
          <a href="#how" className="footer-link">
            Как это работает
          </a>
          {/* Вошедшему покупателю раздел для заведений не нужен (как и в шапке) — гостю остаётся. */}
          {user ? null : (
            <a href={`${BASE}/for-business`} className="footer-link">
              Для бизнеса
            </a>
          )}
          <a href="#faq" className="footer-link">
            Вопросы
          </a>
          {/* Заглушка: раздела блога пока нет, поэтому это кнопка в стиле ссылки без перехода
              (а не <a href="/blog">, который вёл бы на 404 при открытии в новой вкладке).
              Когда страница появится — заменить на <Link to="/blog" className="footer-link">. */}
          <button type="button" className="footer-link footer-link-button" aria-disabled="true" title="Раздел скоро появится">
            Блог
          </button>
        </div>
        <div>
          <p className="footer-col-title">Аккаунт</p>
          <a href={`${BASE}/login`} className="footer-link">
            Войти
          </a>
          <a href={`${BASE}/register`} className="footer-link">
            Регистрация
          </a>
        </div>
        <div>
          <p className="footer-col-title">Контакты</p>
          <a href="mailto:hello@apetite.ru" className="footer-link">
            hello@apetite.ru
          </a>
          <p className="footer-link" style={{ cursor: "default" }}>
            Санкт-Петербург, Россия
          </p>
        </div>
      </div>
      <div className="container footer-bottom">
        <div className="footer-bottom-text">
          <span>© {new Date().getFullYear()} Appetite. Все права защищены.</span>
          <span>Бета — цены и доступность в тестовом режиме</span>
        </div>
        <div className="footer-app">
          <AppQr value={appLink()} label="QR-код: открыть Appetite на телефоне" />
          <div className="footer-app-stores">
            <p className="footer-app-title">Appetite на телефоне</p>
            <AppStoreBadge href={APP_STORE_URL} />
            <GooglePlayBadge href={GOOGLE_PLAY_URL} />
          </div>
        </div>
      </div>
    </footer>
  );
}
