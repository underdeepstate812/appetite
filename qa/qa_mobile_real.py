"""Сквозной сценарий мобильного web-приложения на РЕАЛЬНОМ backend: вход -> оффер -> оплата -> билет (настоящий PNG-QR) ->
заказы -> помощь -> перезапуск без сети (офлайн-билет) -> выход (кэш стёрт).

Нужны: backend :3000 с seed (демо-аккаунт из prisma/seed.ts — QA_USER / QA_PASSWORD), mobile-web :8081, витрина офферов
(pnpm --filter @apetite/backend prisma:seed:showcase). Работает ТОЛЬКО с локальным dev-хостом: на чужой адрес скрипт не пойдёт.
Создаёт настоящий тестовый заказ в локальной БД. Запуск: python3 qa/qa_mobile_real.py"""
import json, os, re, sys, tempfile
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

QA = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(QA, "qa_mobile_orders.py")).read().split("\nwith sync_playwright() as p:")[0])  # check, cards, tab, texts, overflow, PH, SMALL, BASE, go_checkout …
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())
USER = os.environ.get("QA_USER", "user@apetite.ru")
PASSWORD = os.environ.get("QA_PASSWORD", "password123")  # демо-аккаунт из prisma/seed.ts

# Защита: тестовые логин/пароль вводятся только в собственное приложение на локальном dev-хосте.
API = re.search(r"EXPO_PUBLIC_API_BASE_URL=(\S+)", open(os.path.join(QA, "..", "apps", "mobile", ".env")).read()).group(1)
for url in (BASE, API):
    host = urlparse(url).hostname
    if host not in ("localhost", "127.0.0.1", "::1"):
        sys.exit(f"Отказ: {url} — не локальный dev-хост; сквозной сценарий с тестовым входом запускается только на localhost.")

keys_of = lambda page: page.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('apetite.offline.'))")
digits = lambda page: re.sub(r"\D", "", texts(page))
rows_of = lambda page: [r.get_attribute("aria-label") for r in page.locator('[role=button][aria-label*="₽"]:not([data-testid=offer-ribbon] [role=button])').all()]
fld = lambda page, label: page.locator(f'input[aria-label="{label}"]:visible')

def qr_info(page):
    """QR на экране — настоящий PNG из data:-ссылки: картинка в фоне блока и она реально декодируется браузером."""
    return page.evaluate("""async () => {
      const e = document.querySelector('[data-testid=pickup-qr]'); if (!e) return null;
      const bg = [...e.querySelectorAll('*')].map(c => getComputedStyle(c).backgroundImage).find(b => b.includes('data:image/png'));
      if (!bg) return { shown: false };
      const src = bg.match(/url\\("?(.*?)"?\\)$/)[1];
      const size = await new Promise(res => { const i = new window.Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = src; });
      return { shown: true, width: size, length: src.length };
    }""")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport=PH, color_scheme="dark", geolocation={"latitude": 59.9311, "longitude": 30.3609}, permissions=["geolocation"], locale="ru-RU")
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    page.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" and not re.search("vibrate|collapsable|transform-origin|Failed to load resource|non-boolean|Invalid DOM|ERR_FAILED|net::", m.text) else None)

    # ───────── вход (форма приложения, демо-аккаунт) ─────────
    page.goto(BASE, wait_until="networkidle"); page.wait_for_timeout(1500)
    page.get_by_role("button", name="Войти", exact=True).click(); fld(page, "Email").wait_for(timeout=15000)  # приветственная страница → форма входа
    fld(page, "Email").fill(USER); fld(page, "Пароль").fill(PASSWORD)
    page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_timeout(3000)
    check("реальный вход: открылась Главная", page.get_by_role("tab", name="Заказы").count() == 1, texts(page)[:160])
    ks0 = keys_of(page)

    # ───────── оффер → оплата ─────────
    page.wait_for_timeout(1500)
    card = cards(page).first; card_text = card.inner_text(); card.click(); page.wait_for_timeout(2000)
    T = texts(page)
    title = next((l for l in card_text.split("\n") if len(l) > 6 and "₽" not in l and "км" not in l and "мин" not in l and not l.startswith("−")), "")
    check("оффер открылся: есть кнопка «Купить», заведение и адрес из реального API", page.get_by_role("button", name="Купить").count() == 1 and "ГДЕ ЗАБИРАТЬ" in T.upper(), T[:200])
    page.get_by_role("button", name="Купить").click(); page.wait_for_timeout(1800); T = texts(page)
    check("оплата: сводка с названием, заведением·адресом и окном выдачи (реальные данные)", "Оформление заказа" in T and re.search(r"Забрать: \d{2}:\d{2}", T) and (title in T if title else True), T[:300])
    check("оплата: правило над кнопкой («Оплата окончательная», «Заберите до»)", "Оплата окончательная" in T and re.search(r"Заберите до (завтра )?\d{2}:\d{2}", T))
    page.screenshot(path=os.path.join(OUT, "real_checkout.png"))
    pay(page); T = texts(page)
    check("билет: «Заказ принят», код из 6 цифр", "Заказ принят" in T and re.search(r"Код самовывоза: (\d ){5}\d", page.locator("[aria-label^='Код самовывоза:']").first.get_attribute("aria-label")), T[:200])
    code = re.sub(r"\D", "", page.locator("[aria-label^='Код самовывоза:']").first.get_attribute("aria-label"))
    qr = qr_info(page)
    check("билет: QR — настоящий PNG от backend, браузер его декодирует (≥ 100 px)", qr and qr.get("shown") and qr["width"] >= 100, qr)
    check("билет: «Где забрать» с реальным заведением и «Маршрут»", "ГДЕ ЗАБРАТЬ" in T.upper() and page.get_by_role("button", name=re.compile("Построить маршрут")).count() == 1)
    page.screenshot(path=os.path.join(OUT, "real_ticket.png"))
    ks = keys_of(page); tk = next((k for k in ks if ".ticket." in k), None)
    saved = json.loads(page.evaluate("k => localStorage.getItem(k)", tk)) if tk else None
    check("сохранённая копия: код тот же, QR настоящий (> 500 байт), заведение и название на месте", saved and saved["order"]["pickupCode"] == code and len(saved["qrCodeDataUrl"] or "") > 500 and saved["venue"]["name"] and saved["offer"]["title"], saved and {k: (str(v)[:60]) for k, v in saved.items()})
    check("сохранённая копия: нет лишнего (токенов, паролей, e-mail)", saved and not re.search(r"token|password|@apetite\.ru", json.dumps(saved), re.I))
    venue_name = saved["venue"]["name"] if saved else ""
    offer_title = saved["offer"]["title"] if saved else ""
    order_id = saved["order"]["id"] if saved else ""
    check("консоль без ошибок на пути оплаты", not errs, errs[:3])

    # ───────── заказы ─────────
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(2800)
    rows = rows_of(page)
    check("«Заказы»: новый заказ первым — название, заведение, сумма, статус", rows and rows[0].startswith(f"{offer_title}, {venue_name}, ") and "Ожидает самовывоза" in rows[0], rows[:2])
    page.screenshot(path=os.path.join(OUT, "real_orders.png"))
    page.get_by_role("button", name=re.compile("^" + re.escape(offer_title) + ", " + re.escape(venue_name))).first.click(); page.wait_for_timeout(2200); T = texts(page)
    check("заказ: название, заведение, код и «Нужна помощь»", offer_title in T and venue_name in T and code in digits(page) and page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).count() == 1, T[:200])
    page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).click(); page.wait_for_timeout(700)
    capture_mail(page); page.get_by_role("button", name="Написать на почту").click(); page.wait_for_timeout(300)
    u = opened(page); from urllib.parse import parse_qs; q = {k: v[0] for k, v in parse_qs(urlparse(u).query).items()} if u else {}
    body = q.get("body", "")
    check("письмо: реальный ID заказа, название, заведение; кода самовывоза нет", order_id in body and offer_title in body and venue_name in body and code not in body and code not in (u or ""), body)
    page.keyboard.press("Escape"); page.wait_for_timeout(500)

    # ───────── перезапуск без сети ─────────
    # Адрес сохраняется: после перезагрузки приложение открывается прямо на экране билета — он обязан открыться из копии.
    ctx.route("**/api/v1/**", lambda route, request: route.abort("connectionrefused"))
    page.reload(wait_until="networkidle"); page.wait_for_timeout(2500); T = texts(page)
    check("без сети, после перезапуска на экране билета: он открылся из копии — тот же код, настоящий QR, плашка «Нет сети»", code in digits(page) and (qr_info(page) or {}).get("width", 0) >= 100 and "Нет сети" in T and "код можно показать кассиру" in T, (digits(page)[:40], qr_info(page), T[:120]))
    check("без сети: на билете заведение, адрес и «Маршрут» из копии", venue_name in T and page.get_by_role("button", name=re.compile("Построить маршрут")).count() == 1)
    page.screenshot(path=os.path.join(OUT, "real_offline_ticket.png")); axe_ok(page, "офлайн-билет на реальных данных")
    # холодный старт на списке заказов
    page.goto(BASE + "/orders", wait_until="networkidle"); page.wait_for_timeout(2500)
    T = texts(page); rows = rows_of(page)
    check("без сети: «Заказы» из сохранённого списка с плашкой", "Нет сети" in T and rows and rows[0].startswith(f"{offer_title}, {venue_name}, "), (T[:160], rows[:1]))
    page.screenshot(path=os.path.join(OUT, "real_offline_list.png"))
    ctx.unroute("**/api/v1/**"); page.get_by_role("button", name="Обновить").first.click(); page.wait_for_timeout(2800)
    check("связь вернулась: «Обновить» снимает плашку, список свежий", "Нет сети" not in texts(page) and rows_of(page) and rows_of(page)[0].startswith(f"{offer_title}, {venue_name}, "))

    # ───────── выход ─────────
    tab(page, "Профиль"); page.wait_for_timeout(600)
    page.get_by_role("button", name="Выйти").click(); page.wait_for_timeout(2000)
    left = keys_of(page)
    on_welcome = page.get_by_role("button", name="Создать аккаунт", exact=True).count() == 1 and page.get_by_role("button", name="Войти", exact=True).count() == 1
    check("выход: сохранённые билеты и список стёрты, показана приветственная страница", not left and on_welcome, (left, texts(page)[:100]))
    check("итог: консоль без ошибок", not errs, errs[:3])
    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
