"""Сайт (apps/web), личный кабинет в шапке — РЕАЛЬНЫЙ backend, демо-аккаунт user@apetite.ru (только localhost).
Гость видит лендинг-ссылки; после входа — только покупательское (Витрина, Мои заказы), без «Для бизнеса»/«Как это работает»/«Вопросы»; логотип ведёт на витрину;
выпадающее меню (десктоп): личность, фокус/стрелки/Esc, выход; мобильная панель: личность, пункты, закрытие по переходу и Esc с возвратом фокуса; футер без «Для бизнеса».
Нужны backend :3000 и web :5174. Запуск: python3 qa/qa_web_account.py"""
import os, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

WEB = os.environ.get("WEB_URL", "http://localhost:5174")
if urlparse(WEB).hostname not in ("localhost", "127.0.0.1", "::1"):
    sys.exit(f"Отказ: {WEB} — не локальный dev-хост; сценарий с тестовым входом идёт только на localhost.")
PASSWORD = os.environ.get("QA_PASSWORD", "password123")  # демо-аккаунты из prisma/seed.ts
fails = []
def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (" | " + str(detail)[:300] if detail and not cond else ""))
    if not cond: fails.append(name)

def login(page):
    page.goto(WEB + "/login"); page.fill("#email", "user@apetite.ru"); page.fill("#password", PASSWORD); page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_url("**/home", timeout=15000)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    # ---- гость ----
    page = b.new_context(viewport={"width": 1280, "height": 820}, locale="ru-RU").new_page(); errs = []; page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    page.goto(WEB + "/"); page.wait_for_timeout(800)
    check("гость: в навигации лендинг-ссылки, в том числе «Для бизнеса»", page.locator(".site-nav-desktop a").all_inner_texts() == ["Витрина", "Как это работает", "Для бизнеса", "Вопросы"], page.locator(".site-nav-desktop a").all_inner_texts())
    check("гость: логотип ведёт на «/»", page.locator("a.site-logo").get_attribute("href") == "/")
    check("гость: в футере есть «Для бизнеса»", page.locator("footer a", has_text="Для бизнеса").count() == 1)

    # ---- десктоп, вошедший ----
    login(page); page.wait_for_timeout(1200)
    check("после входа — витрина", page.url.endswith("/home"))
    check("вошедший: в навигации только Витрина и Мои заказы", page.locator(".site-nav-desktop a").all_inner_texts() == ["Витрина", "Мои заказы"], page.locator(".site-nav-desktop a").all_inner_texts())
    check("текущая страница отмечена aria-current", page.locator(".site-nav-desktop a[aria-current=page]").all_inner_texts() == ["Витрина"])
    check("логотип ведёт на витрину", page.locator("a.site-logo").get_attribute("href") == "/home")
    check("«Для бизнеса» нет ни в шапке, ни в футере", page.get_by_text("Для бизнеса").count() == 0, page.get_by_text("Для бизнеса").count())
    btn = page.locator(".user-menu-btn"); btn.click(); page.wait_for_timeout(300)
    menu = page.get_by_role("menu", name="Личный кабинет")
    check("меню: имя и email вошедшего", menu.count() == 1 and "user@apetite.ru" in menu.inner_text() and "Тестовый пользователь" in menu.inner_text(), menu.inner_text())
    items = menu.get_by_role("menuitem")
    check("в меню: «Профиль и настройки», «Мои заказы», «Выйти» (+«1 клик», если согласие выдано)", [t.split("\n")[0] for t in items.all_inner_texts()][-1] == "Выйти" and "Профиль и настройки" in items.first.inner_text() and any("Мои заказы" in t for t in items.all_inner_texts()), items.all_inner_texts())
    check("фокус на первом пункте", page.evaluate("document.activeElement.textContent.includes('Профиль и настройки')"))
    page.keyboard.press("ArrowDown"); check("стрелка вниз — следующий пункт", page.evaluate("document.activeElement.textContent.includes('Мои заказы')"))
    page.keyboard.press("Escape"); page.wait_for_timeout(150)
    check("Esc закрывает меню и возвращает фокус на кнопку", page.get_by_role("menu").count() == 0 and page.evaluate("document.activeElement.classList.contains('user-menu-btn')"))
    btn.click(); menu.get_by_role("menuitem", name="Мои заказы").click(); page.wait_for_url("**/orders"); page.wait_for_timeout(400)
    check("«Мои заказы»: страница открылась, меню закрылось, пункт навигации подсвечен", page.get_by_role("menu").count() == 0 and page.locator(".site-nav-desktop a[aria-current=page]").all_inner_texts() == ["Мои заказы"])
    btn.click(); page.get_by_role("menuitem", name="Выйти").click(); page.wait_for_url(WEB + "/", timeout=10000); page.wait_for_timeout(500)
    check("выход: на главную, у гостя снова лендинг-ссылки", page.locator(".site-nav-desktop a").all_inner_texts() == ["Витрина", "Как это работает", "Для бизнеса", "Вопросы"] and page.locator(".user-menu-btn").count() == 0)

    # ---- телефон, вошедший ----
    m = b.new_context(viewport={"width": 390, "height": 844}, locale="ru-RU").new_page(); m.on("pageerror", lambda e: errs.append(str(e)[:200]))
    login(m); m.wait_for_timeout(1000)
    burger = m.get_by_role("button", name="Открыть меню"); burger.click(); m.wait_for_timeout(700)
    panel = m.locator(".mobile-menu.is-open")
    check("мобильная панель: личность, Витрина, Профиль, Мои заказы, Выйти", panel.count() == 1 and panel.get_by_role("link", name="Профиль и настройки").count() == 1 and "Тестовый пользователь" in panel.inner_text() and "user@apetite.ru" in panel.inner_text() and panel.get_by_role("link", name="Витрина").count() == 1 and panel.get_by_role("link", name="Мои заказы").count() == 1 and panel.get_by_role("button", name="Выйти").count() == 1)
    check("мобильная панель: нет «Для бизнеса», «Как это работает», «Вопросы», «Войти»", all(panel.get_by_text(t).count() == 0 for t in ("Для бизнеса", "Как это работает", "Вопросы", "Войти")))
    check("страница под панелью не прокручивается (menu-open)", m.evaluate("document.documentElement.classList.contains('menu-open') && getComputedStyle(document.documentElement).overflow === 'hidden'"))
    m.screenshot(path=os.path.join(os.environ.get("QA_OUT", "/tmp"), "web_account_mobile.png"))
    m.keyboard.press("Escape"); m.wait_for_timeout(300)
    check("Esc закрывает панель и возвращает фокус на бургер", m.locator(".mobile-menu.is-open").count() == 0 and m.evaluate("document.activeElement.classList.contains('hamburger-btn')") and not m.evaluate("document.documentElement.classList.contains('menu-open')"))
    burger.click(); m.wait_for_timeout(500); m.locator(".mobile-menu.is-open").get_by_role("link", name="Мои заказы").click(); m.wait_for_url("**/orders"); m.wait_for_timeout(500)
    check("переход по пункту закрывает панель и снимает блокировку прокрутки", m.locator(".mobile-menu.is-open").count() == 0 and not m.evaluate("document.documentElement.classList.contains('menu-open')"))
    burger.click(); m.wait_for_timeout(500); m.locator(".mobile-menu.is-open").get_by_role("button", name="Выйти").click(); m.wait_for_url(WEB + "/", timeout=10000)
    check("мобильный выход: на главную, гостевая панель с «Войти»", m.get_by_role("button", name="Открыть меню").count() == 1)
    check("нет JS-ошибок", not errs, errs[:2])
    b.close()

print(f"\n{'FAILED: ' + str(len(fails)) if fails else 'ALL PASSED'}"); sys.exit(1 if fails else 0)
