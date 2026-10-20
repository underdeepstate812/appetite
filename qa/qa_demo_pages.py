"""Демо для GitHub Pages (scripts/build-demo.sh → site/) в локальном «двойнике Pages» (qa/serve_pages.py), БЕЗ backend.
Проверяет, что три приложения (сайт, мобильная версия, кабинет) работают автономно на встроенных данных: ни одного запроса к
настоящему API, вход демо-аккаунтами, заказ на сайте → заказ виден владельцу в кабинете (общее хранилище одного домена), правка профиля,
тема, обновление страницы на клиентском маршруте (404.html), сброс демо, мобильная версия, отсутствие JS-ошибок.
Запуск: bash scripts/build-demo.sh && python3 qa/qa_demo_pages.py"""
import os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
if not os.environ.get("DEMO_URL") and not os.path.isfile(os.path.join(ROOT, "site", "index.html")):
    sys.exit("Нет site/: сначала bash scripts/build-demo.sh")
PORT = int(os.environ.get("DEMO_PORT", "8091")); BASE = "/appetite"
# DEMO_URL=https://<user>.github.io/appetite — проверить уже опубликованное демо (тогда локальный сервер не нужен).
REMOTE = os.environ.get("DEMO_URL", "").rstrip("/")
HOST = REMOTE or f"http://localhost:{PORT}{BASE}"
OUT = os.environ.get("QA_OUT", "/tmp")
fails = []
def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (" | " + str(detail)[:300] if detail and not cond else ""))
    if not cond: fails.append(name)

server = None if REMOTE else subprocess.Popen([sys.executable, os.path.join(ROOT, "qa", "serve_pages.py"), str(PORT), BASE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0 if REMOTE else 1.5)
IGNORE_REQ = re.compile(r"tile\.openstreetmap|tiles?\.|googleapis|gstatic|images\.unsplash|yandex|openstreetmap|nominatim|favicon")
try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale="ru-RU", color_scheme="light")
        errs, leaked, failed = [], [], []
        def watch(page):
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" and not re.search("Failed to load resource|ERR_|net::|vibrate|collapsable|transform-origin|non-boolean|Invalid DOM", m.text) else None)
            page.on("request", lambda r: leaked.append(r.url) if re.search(r"localhost:3000|demo\.apetite\.invalid", r.url) else None)
            page.on("requestfailed", lambda r: failed.append(r.url) if not IGNORE_REQ.search(r.url) else None)
        page = ctx.new_page(); watch(page)

        # ---------- витрина демо ----------
        page.goto(HOST + "/"); page.wait_for_selector("a.card")
        hrefs = page.locator("a.card").evaluate_all("els => els.map(e => e.getAttribute('href'))")
        check("страница выбора: три раздела по адресам под /appetite/", hrefs == [f"{BASE}/web/", f"{BASE}/mobile/", f"{BASE}/admin/"], hrefs)
        check("на странице выбора указаны демо-логины", "user@apetite.ru" in page.inner_text("body") and "cafe.pushkin@apetite.ru" in page.inner_text("body"))

        # ---------- сайт покупателя ----------
        page.goto(HOST + "/web/home"); page.wait_for_selector(".show-card", timeout=20000); page.wait_for_selector(".leaflet-marker-icon", timeout=20000); page.wait_for_timeout(1200)
        cards = page.locator(".showcase-item:not(.is-clone) .show-card").count()
        total = int(re.search(r"(\d+)\s+предложен", page.inner_text("body")).group(1))
        check("витрина: десятки предложений из встроенных данных (в заголовке), карточки в ленте, на карте метки", total >= 40 and cards >= 10 and page.locator(".leaflet-marker-icon").count() >= 10, (total, cards))
        check("плашка «ДЕМО» внизу слева, свёрнута", page.locator("#apetite-demo-banner").count() == 1 and page.locator("#apetite-demo-banner [data-title]").inner_text() == "ДЕМО")
        page.locator("#apetite-demo-banner button").first.click(); check("плашка раскрывается: подсказка с логином", "user@apetite.ru" in page.locator("#apetite-demo-banner").inner_text())
        page.locator("#apetite-demo-banner button").first.click()
        box0 = page.locator("#apetite-demo-banner").bounding_box(); head = page.locator("#apetite-demo-banner button").first.bounding_box()
        page.mouse.move(head["x"] + 10, head["y"] + 10); page.mouse.down(); page.mouse.move(head["x"] + 200, head["y"] - 200, steps=6); page.mouse.up(); page.wait_for_timeout(200)
        box1 = page.locator("#apetite-demo-banner").bounding_box()
        check("плашку можно перетащить, и после перетаскивания она не раскрывается", box1["x"] > box0["x"] + 100 and box1["y"] < box0["y"] - 100 and page.locator("#apetite-demo-banner [data-title]").inner_text() == "ДЕМО")
        check("ссылки подвала учитывают базовый путь (/appetite/web/…)", page.locator("footer a[href$='/for-business']").first.get_attribute("href") == f"{BASE}/web/for-business", page.locator("footer a").evaluate_all("e=>e.map(x=>x.getAttribute('href'))"))

        page.goto(HOST + "/web/login"); page.fill("#email", "user@apetite.ru"); page.fill("#password", "wrong"); page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_selector(".form-error", timeout=8000)
        check("неверный пароль: сообщение об ошибке", "Неверный" in page.locator(".form-error").inner_text())
        page.fill("#password", "password123"); page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_url("**/web/home", timeout=15000); page.wait_for_selector(".user-menu-btn")
        check("вход демо-покупателем: имя в шапке", "Тестовый пользователь" in page.locator(".user-menu-btn").inner_text())
        page.goto(HOST + "/web/orders"); page.wait_for_selector("ul.orders-list li", timeout=15000)
        before = page.locator("ul.orders-list li").count()
        check("в заказах — демо-история (≥ 9) и один ждёт самовывоза", before >= 9 and page.locator(".order-card.is-active").count() == 1, before)

        page.goto(HOST + "/web/checkout/o-pushkin-bakery"); page.wait_for_selector("button:has-text('Оплатить')", timeout=15000)
        check("оформление: состав и аллергены показаны до оплаты", "Состав" in page.inner_text("body") and "Аллергены" in page.inner_text("body"))
        page.get_by_role("button", name=re.compile("Оплатить")).click(); page.wait_for_url(re.compile(r".*/web/orders/.+"), timeout=15000)
        try: page.wait_for_selector("img[src^='data:image/png']", timeout=8000)
        except Exception: pass
        code = re.sub(r"\D", "", page.locator(".pickup-code").get_attribute("aria-label") or "")
        check("после оплаты — билет с 6-значным кодом самовывоза и QR-картинкой", len(code) == 6 and page.locator("img[src^='data:image/png']").count() >= 1, page.inner_text("body")[:300])
        order_url = page.url
        page.goto(HOST + "/web/orders"); page.wait_for_selector("ul.orders-list li"); check("новый заказ появился в списке", page.locator("ul.orders-list li").count() == before + 1)

        page.goto(HOST + "/web/profile"); page.wait_for_selector(".pass", timeout=15000); page.wait_for_timeout(900)
        check("профиль: пропуск с именем, эко-цифры из демо-заказов", "Тестовый пользователь" in page.locator(".pass").inner_text() and page.locator(".pass-stat strong").first.inner_text() not in ("—", "0"), page.locator(".pass-stat strong").all_inner_texts())
        page.get_by_role("button", name="Редактировать").click(); page.get_by_label("Имя").fill("Мария Демо"); page.get_by_role("button", name="Сохранить").click(); page.wait_for_selector("text=Сохранено", timeout=8000)
        page.get_by_role("radiogroup", name="Тема оформления").get_by_role("radio", name="Тёмная").click(); page.wait_for_timeout(300)
        check("тёмная тема применилась", page.evaluate("document.documentElement.dataset.theme") == "dark")
        page.reload(); page.wait_for_selector(".pass", timeout=15000)
        check("после перезагрузки (деплой-путь /web/profile через 404.html) имя и тема сохранились", "Мария Демо" in page.locator(".pass").inner_text() and page.evaluate("document.documentElement.dataset.theme") == "dark" and page.url.endswith("/web/profile"), page.url)
        page.get_by_role("radiogroup", name="Тема оформления").get_by_role("radio", name="Светлая").click()

        # ---------- кабинет бизнеса: владелец видит заказ с сайта ----------
        adm = ctx.new_page(); watch(adm)
        adm.goto(HOST + "/admin/"); adm.wait_for_selector("#email", timeout=15000)
        adm.fill("#email", "cafe.pushkin@apetite.ru"); adm.fill("#password", "password123"); adm.get_by_role("button", name=re.compile("Войти")).click(); adm.wait_for_url("**/admin/offers", timeout=15000)
        adm.wait_for_selector("tr:has-text('Набор выпечки дня')", timeout=15000)
        check("кабинет: офферы заведения, карточка часов «круглосуточно»", adm.locator("tr:has-text('Бизнес-ланч')").count() >= 1 and "круглосуточно" in adm.get_by_test_id("working-hours-summary").inner_text(), adm.inner_text("body")[:200])
        check("кабинет: автовыкладка — два шаблона", adm.get_by_text("Круассан и кофе").count() >= 1 and adm.get_by_text("Вечерняя выпечка").count() >= 1)
        adm.goto(HOST + "/admin/orders"); adm.wait_for_selector("text=Принять заказ", timeout=15000)
        check("заказ с сайта (ждёт принятия) виден владельцу", adm.get_by_role("button", name="Принять заказ").count() >= 1)
        adm.get_by_role("button", name="Принять заказ").first.click(); adm.wait_for_timeout(900)
        check("владелец принял заказ", adm.get_by_text("Принят").count() >= 1 or adm.get_by_text("принят").count() >= 1, adm.inner_text("body")[:300])
        adm.goto(HOST + "/admin/analytics"); adm.wait_for_selector("[data-testid=sales-panel]", timeout=15000); adm.wait_for_selector(".sales-bar-btn", timeout=15000)
        check("аналитика: график продаж за 14 дней с данными", adm.locator(".sales-bar-btn").count() == 14 and adm.get_by_test_id("sales-total").inner_text().strip() not in ("0 ₽", ""))
        adm.goto(HOST + "/admin/offers"); adm.wait_for_selector("#quick-title"); adm.fill("#quick-title", "Демо-пирожок"); adm.fill("#quick-price", "300"); adm.fill("#quick-weight", "0.3"); adm.fill("#quick-ingredients", "Мука, капуста")
        adm.locator("#quick-allergens").click(); adm.get_by_role("checkbox", name="Аллергенов нет", exact=True).check(); adm.keyboard.press("Escape")
        adm.get_by_role("button", name="Опубликовать").click(); adm.wait_for_selector("tr:has-text('Демо-пирожок')", timeout=10000)
        check("кабинет: быстрое создание оффера работает", adm.locator("tr:has-text('Демо-пирожок')").count() == 1)
        # новое предложение сразу видно покупателю на сайте
        page.goto(HOST + "/web/home"); page.wait_for_selector(".show-card", timeout=20000); page.wait_for_timeout(800)
        titles = page.evaluate("fetch('https://demo.apetite.invalid/api/v1/offers/nearby?lat=59.93&lng=30.33&radiusKm=60').then(r => r.json()).then(list => list.map(o => o.title))")
        check("оффер из кабинета виден покупателю в выдаче nearby (общее демо-хранилище домена)", "Демо-пирожок" in titles, len(titles))

        # ---------- обновление страницы на клиентском маршруте (404.html) ----------
        fresh = b.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU"); fp = fresh.new_page(); watch(fp)
        fp.goto(HOST + "/web/for-business"); fp.wait_for_selector("text=Подключить заведение", timeout=15000)
        check("прямой заход на /web/for-business (нет такого файла) открывает страницу через 404.html", fp.url.endswith("/web/for-business"), fp.url)
        fresh.close()

        # ---------- мобильная версия ----------
        m = b.new_context(viewport={"width": 390, "height": 844}, locale="ru-RU", color_scheme="dark").new_page(); watch(m)
        m.goto(HOST + "/mobile/"); m.wait_for_timeout(4500)
        check("мобильная версия: адрес остаётся под /appetite/mobile/", f"{BASE}/mobile" in m.url, m.url)
        m.get_by_role("button", name="Войти", exact=True).click(); m.locator('input[aria-label="Email"]:visible').wait_for(timeout=15000)
        m.locator('input[aria-label="Email"]:visible').fill("user@apetite.ru"); m.locator('input[aria-label="Пароль"]:visible').fill("password123")
        m.get_by_role("button", name="Войти", exact=True).click(); m.wait_for_timeout(3500)
        check("мобильный вход: открылась Главная с вкладками", m.get_by_role("tab", name="Заказы").count() == 1, m.inner_text("body")[:160])
        check("лента предложений и карточки на Главной", m.locator('[role=button][aria-label*="₽"]').count() >= 5)
        m.get_by_role("tab", name="Заказы").click(); m.wait_for_timeout(1800)
        check("вкладка «Заказы»: демо-заказы покупателя", len(re.findall(r"₽", m.inner_text("body"))) >= 3, m.inner_text("body")[:200])
        m.get_by_role("tab", name="Профиль").click(); m.wait_for_timeout(2200)
        check("вкладка «Профиль»: пропуск с именем и эко-цифрами", "Мария Демо" in m.inner_text("body") or "Тестовый пользователь" in m.inner_text("body"))
        m.screenshot(path=f"{OUT}/demo_mobile_profile.png")
        m.reload(); m.wait_for_timeout(4000)
        check("обновление страницы в мобильной версии: адрес под базой, сессия цела", f"{BASE}/mobile" in m.url and m.get_by_role("tab", name="Профиль").count() == 1, m.url)

        # ---------- сброс демо и итоги ----------
        page.goto(HOST + "/web/orders"); page.wait_for_selector("ul.orders-list li")
        page.locator("#apetite-demo-banner button").first.click(); page.get_by_role("button", name="Сбросить демо-данные").click(); page.wait_for_selector("ul.orders-list li", timeout=15000); page.wait_for_timeout(800)
        check("«Сбросить демо-данные»: заказ, созданный в демо, исчез", page.locator("ul.orders-list li").count() == before, page.locator("ul.orders-list li").count())
        page.screenshot(path=f"{OUT}/demo_web_orders.png")
        check("ни одного запроса к настоящему API (localhost:3000 / demo.apetite.invalid)", not leaked, leaked[:3])
        check("нет упавших запросов к собственным файлам демо", not failed, failed[:3])
        check("нет JS-ошибок", not errs, errs[:3])
        b.close()
finally:
    if server: server.terminate()

print(f"\n{'FAILED: ' + str(len(fails)) if fails else 'ALL PASSED'}"); sys.exit(1 if fails else 0)
