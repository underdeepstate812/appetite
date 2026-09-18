import { AppetiteMark } from "./AppetiteMark";

export function Footer() {
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
          <a href="/for-business" className="footer-link">
            Для бизнеса
          </a>
          <a href="#faq" className="footer-link">
            Вопросы
          </a>
        </div>
        <div>
          <p className="footer-col-title">Аккаунт</p>
          <a href="/login" className="footer-link">
            Войти
          </a>
          <a href="/register" className="footer-link">
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
        <span>© {new Date().getFullYear()} Appetite. Все права защищены.</span>
        <span>Бета — цены и доступность в тестовом режиме</span>
      </div>
    </footer>
  );
}
