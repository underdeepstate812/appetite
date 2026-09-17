export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <p className="footer-logo" style={{ marginBottom: 10 }}>
            🍊 Apetite
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
            Спасаем вкусную еду от списания — заведения продают остатки со скидкой
            50–70%, ты забираешь самовывозом. Пилот — Москва.
          </p>
        </div>
        <div>
          <p className="footer-col-title">Продукт</p>
          <a href="#how" className="footer-link">
            Как это работает
          </a>
          <a href="#business" className="footer-link">
            Для заведений
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
            Москва, Россия
          </p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Apetite. Все права защищены.</span>
        <span>Бета — цены и доступность в тестовом режиме</span>
      </div>
    </footer>
  );
}
