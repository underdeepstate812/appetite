"""Сайт (apps/web): профиль по образцу мобильного приложения — РЕАЛЬНЫЙ backend, одноразовый тестовый аккаунт (только localhost).
Пропуск (имя, уровень, «с нами с», цифры, номер), правка имени/email на месте (валидация, «только изменённое», занятый email — ошибка сервера),
смена фото (реальная загрузка, отказ для не-картинки), тема (система/светлая/тёмная: применяется, запоминается, без вспышки при перезагрузке), помощь (mailto),
выход, раскладка 375 без горизонтальной прокрутки. Аккаунт `qa.profile.*@example.com` создаётся на лету и (если доступен docker) удаляется в конце.
Нужны backend :3000 и web :5174. Запуск: python3 qa/qa_web_profile.py"""
import json, os, struct, subprocess, sys, tempfile, urllib.request, zlib
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

WEB = os.environ.get("WEB_URL", "http://localhost:5174"); API = os.environ.get("API_URL", "http://localhost:3000/api/v1"); OUT = os.environ.get("QA_OUT", "/tmp")
for url in (WEB, API):
    if urlparse(url).hostname not in ("localhost", "127.0.0.1", "::1"):
        sys.exit(f"Отказ: {url} — не локальный dev-хост; сценарий с тестовым аккаунтом идёт только на localhost.")
fails = []
def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (" | " + str(detail)[:300] if detail and not cond else ""))
    if not cond: fails.append(name)
def api(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + token} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode(); return r.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "null")
def png(path):  # крошечный валидный PNG 8×8
    raw = b"".join(b"\x00" + bytes([15, 118, 110] * 8) for _ in range(8))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))

tag = os.urandom(3).hex(); EMAIL = f"qa.profile.{tag}@example.com"; PASS = "Qa!pass1234Xy"
st, reg = api("POST", "/auth/register", {"email": EMAIL, "password": PASS, "name": "Мария Тестова"}); assert st in (200, 201), (st, reg)
tmp = tempfile.mkdtemp(); img = os.path.join(tmp, "a.png"); png(img); doc = os.path.join(tmp, "doc.txt"); open(doc, "w").write("не картинка")

try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale="ru-RU", color_scheme="light"); page = ctx.new_page(); errs = []; page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        page.goto(WEB + "/login"); page.fill("#email", EMAIL); page.fill("#password", PASS); page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_url("**/home", timeout=15000)
        page.locator(".user-menu-btn").click(); page.get_by_role("menuitem", name="Профиль и настройки").click(); page.wait_for_url("**/profile"); page.wait_for_timeout(1200)
        check("из меню — на /profile, заголовок вкладки «Профиль»", "Профиль" in page.title())
        pass_ = page.get_by_label("Пропуск спасателя еды")
        check("пропуск: имя, уровень «Новичок», «С нами с …», номер пропуска", "Мария Тестова" in pass_.inner_text() and "НОВИЧОК" in pass_.inner_text() and "С нами с" in pass_.inner_text() and page.get_by_text("№ ").count() == 1, pass_.inner_text()[:200])
        check("цифры эко-профиля: 0 баллов, 0.0 кг, 0 заказов у нового аккаунта", pass_.locator(".pass-stat strong").all_inner_texts() == ["0", "0.0", "0"], pass_.locator(".pass-stat strong").all_inner_texts())
        check("маршрут: 4 остановки, текущая — «Новичок»", page.locator(".eco-stop").count() == 4 and "Новичок" in page.locator(".eco-stop.is-current").inner_text())
        check("телефон не указан, строка «Не указан»", "Не указан" in pass_.inner_text())
        page.screenshot(path=f"{OUT}/web_profile_light.png", full_page=True)

        # --- правка ---
        page.get_by_role("button", name="Редактировать").click()
        page.get_by_label("Имя").fill("М"); page.get_by_label("Email").fill("не-почта"); page.get_by_role("button", name="Сохранить").click(); page.wait_for_timeout(200)
        check("валидация: короткое имя и кривой email", page.get_by_text("Имя — минимум 2 символа").count() == 1 and page.get_by_text("Некорректный email").count() == 1)
        page.get_by_label("Имя").fill("Мария Тестова-Иванова"); page.get_by_label("Email").fill("admin@apetite.ru"); page.get_by_role("button", name="Сохранить").click(); page.wait_for_timeout(900)
        err = page.locator(".form-error").all_inner_texts()
        check("занятый email — ошибка сервера, форма остаётся с введёнными данными", len(err) == 1 and "уже используется" in err[0] and page.get_by_label("Имя").input_value() == "Мария Тестова-Иванова", err)
        st, me = api("GET", "/auth/me", token=reg["accessToken"]); check("…и на сервере ничего не изменилось (даже имя)", me["name"] == "Мария Тестова" and me["email"] == EMAIL, me)
        page.get_by_label("Email").fill(EMAIL); page.get_by_role("button", name="Сохранить").click(); page.wait_for_selector("text=Сохранено", timeout=8000)
        st, me = api("GET", "/auth/me", token=reg["accessToken"]); check("сохранение имени: на сервере новое имя, email прежний", me["name"] == "Мария Тестова-Иванова" and me["email"] == EMAIL, me)
        check("заголовок пропуска и шапка обновились сразу", page.get_by_role("heading", name="Мария Тестова-Иванова").count() == 1 and "Мария Тестова-Иванова" in page.locator(".user-menu-btn").inner_text())
        page.reload(); page.wait_for_timeout(1000); check("после перезагрузки имя то же (кэш профиля обновлён)", page.get_by_role("heading", name="Мария Тестова-Иванова").count() == 1)
        page.get_by_role("button", name="Редактировать").click(); new_mail = f"qa.profile.{tag}.new@example.com"; page.get_by_label("Email").fill(new_mail); page.get_by_role("button", name="Сохранить").click(); page.wait_for_selector("text=Сохранено", timeout=8000)
        st, me = api("GET", "/auth/me", token=reg["accessToken"]); check("смена email сохраняется", me["email"] == new_mail and "qa.profile" in page.locator(".pass-value").first.inner_text(), me.get("email"))

        # --- фото ---
        page.get_by_test_id("avatar-input").set_input_files(doc); page.wait_for_timeout(300)
        check("не картинка — отказ до отправки", "JPEG, PNG или WebP" in page.locator(".pass-status").inner_text())
        page.get_by_test_id("avatar-input").set_input_files(img); page.wait_for_selector(".pass-avatar img", timeout=10000); page.wait_for_timeout(500)
        st, me = api("GET", "/auth/me", token=reg["accessToken"])
        check("фото загружено: у профиля avatarUrl, на пропуске и в шапке — картинка", (me.get("avatarUrl") or "").startswith("/uploads/avatars/") and page.locator(".pass-avatar img").count() == 1 and page.locator("img.user-menu-avatar").count() == 1, me.get("avatarUrl"))
        loaded = page.evaluate("document.querySelector('.pass-avatar img').naturalWidth > 0")
        check("файл действительно отдаётся сервером (картинка загрузилась)", loaded)

        # --- тема ---
        group = page.get_by_role("radiogroup", name="Тема оформления")
        check("по умолчанию «Системная» и светлая страница", group.get_by_role("radio", name="Системная").get_attribute("aria-checked") == "true" and page.evaluate("document.documentElement.dataset.theme") == "light")
        group.get_by_role("radio", name="Тёмная").click(); page.wait_for_timeout(300)
        bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
        check("«Тёмная»: data-theme=dark и тёмный фон страницы", page.evaluate("document.documentElement.dataset.theme") == "dark" and bg == "rgb(11, 17, 16)", bg)
        page.screenshot(path=f"{OUT}/web_profile_dark.png", full_page=True)
        page.reload(); page.wait_for_timeout(600)
        check("после перезагрузки тёмная тема сохраняется", page.evaluate("document.documentElement.dataset.theme") == "dark" and page.evaluate("localStorage.getItem('apetite.web.theme')") == "dark")
        flash = page.evaluate("getComputedStyle(document.body).backgroundColor")
        check("тема применена до отрисовки (фон сразу тёмный)", flash == "rgb(11, 17, 16)", flash)
        group = page.get_by_role("radiogroup", name="Тема оформления"); group.get_by_role("radio", name="Светлая").click(); page.wait_for_timeout(200)
        check("«Светлая»: светлый фон", page.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(255, 253, 249)")
        group.get_by_role("radio", name="Системная").click(); page.wait_for_timeout(200)
        check("«Системная» стирает выбор в хранилище", page.evaluate("localStorage.getItem('apetite.web.theme')") is None)
        ctx2 = b.new_context(viewport={"width": 1280, "height": 900}, locale="ru-RU", color_scheme="dark"); pg2 = ctx2.new_page()
        pg2.goto(WEB + "/login"); pg2.wait_for_timeout(600)
        check("системная тёмная схема → сайт тёмный без выбора", pg2.evaluate("document.documentElement.dataset.theme") == "dark"); ctx2.close()

        # --- помощь ---
        page.get_by_role("button", name="Помощь и поддержка").click(); dlg = page.get_by_role("dialog", name="Нужна помощь?"); dlg.wait_for()
        check("окно помощи: фокус внутри, 4 темы", page.evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)") and dlg.get_by_role("radio").count() == 4)
        dlg.get_by_role("radio", name="Оплата").click(); href = dlg.get_by_role("link", name="Написать на почту").get_attribute("href")
        check("ссылка письма: адрес поддержки, тема «Оплата», аккаунт", href.startswith("mailto:hello@apetite.ru?") and "Appetite%3A%20%D0%9E%D0%BF%D0%BB%D0%B0%D1%82%D0%B0" in href and new_mail.replace("@", "%40") in href, href[:160])
        page.keyboard.press("Escape"); page.wait_for_timeout(200)
        check("Esc закрывает окно, фокус вернулся на кнопку «Помощь»", page.get_by_role("dialog").count() == 0 and page.evaluate("document.activeElement.textContent.includes('Помощь и поддержка')"))

        # --- телефон ---
        m = b.new_context(viewport={"width": 375, "height": 800}, locale="ru-RU").new_page(); m.on("pageerror", lambda e: errs.append(str(e)[:200]))
        m.goto(WEB + "/login"); m.fill("#email", new_mail); m.fill("#password", PASS); m.get_by_role("button", name="Войти", exact=True).click(); m.wait_for_url("**/home", timeout=15000)
        m.get_by_role("button", name="Открыть меню").click(); m.wait_for_timeout(600); m.locator(".mobile-menu.is-open").get_by_role("link", name="Профиль и настройки").click(); m.wait_for_url("**/profile"); m.wait_for_timeout(1000)
        check("375px: нет горизонтальной прокрутки", m.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), m.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]"))
        check("375px: пропуск, маршрут, настройки одной колонкой", m.locator(".profile-grid").evaluate("e => getComputedStyle(e).gridTemplateColumns.split(' ').length") == 1)
        m.screenshot(path=f"{OUT}/web_profile_mobile.png", full_page=True)
        m.get_by_role("button", name="Выйти").click(); m.wait_for_url(WEB + "/", timeout=10000)
        check("выход из профиля: на главную, гость", m.get_by_role("link", name="Войти").count() >= 1)
        # гость на /profile
        g = b.new_context(viewport={"width": 1280, "height": 800}).new_page(); g.goto(WEB + "/profile"); g.wait_for_url("**/login", timeout=8000)
        check("гость на /profile отправляется на вход", g.url.endswith("/login"))
        check("нет JS-ошибок", not errs, errs[:2])
        b.close()
finally:
    try:
        name = subprocess.run("docker ps --format '{{.Names}}' | grep -i postgres | head -1", shell=True, capture_output=True, text=True).stdout.strip()
        if name: subprocess.run(["docker", "exec", name, "psql", "-U", "apetite", "-d", "apetite", "-c", f"delete from users where email like 'qa.profile.{tag}%'"], capture_output=True, timeout=20)
    except Exception:
        pass

print(f"\n{'FAILED: ' + str(len(fails)) if fails else 'ALL PASSED'}"); sys.exit(1 if fails else 0)
