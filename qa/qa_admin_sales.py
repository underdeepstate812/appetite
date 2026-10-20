"""График продаж в кабинете («Аналитика»): API + UI на РЕАЛЬНОМ backend (seed-аккаунты, только localhost).
API: права (401/403), период 7/14/30 (остальное — 400), форма ответа, согласованность (сумма по дням = итого, «когда покупают» = число заказов),
свой/чужой бизнес. UI: панель, переключение периода и его запоминание, число столбцов, итоги совпадают с API, подробности дня по клику и с клавиатуры,
подписи столбцов, пустое состояние (заведение без продаж), раскладка 375 без горизонтальной прокрутки, нет JS-ошибок.
Данные для графика: pnpm --filter @apetite/backend prisma:seed:sales-history. Нужны backend :3000 и admin :5173.
Запуск: python3 qa/qa_admin_sales.py"""
import json, os, re, sys, urllib.request
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

API = os.environ.get("API_URL", "http://localhost:3000/api/v1"); ADMIN = os.environ.get("ADMIN_URL", "http://localhost:5173")
for url in (API, ADMIN):
    if urlparse(url).hostname not in ("localhost", "127.0.0.1", "::1"):
        sys.exit(f"Отказ: {url} — не локальный dev-хост; сценарий с тестовым входом идёт только на localhost.")
PASSWORD = os.environ.get("QA_PASSWORD", "password123")  # демо-аккаунты из prisma/seed.ts
OUT = os.environ.get("QA_OUT", "/tmp")
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
def login(who):
    st, d = api("POST", "/auth/login", {"identifier": who, "password": PASSWORD}); assert st in (200, 201), (who, d); return d
def my_business(sess):
    st, me = api("GET", "/businesses/mine", token=sess["accessToken"]); return (me[0] if isinstance(me, list) else me)["id"]

owner = login("cafe.pushkin@apetite.ru"); other = login("bulka.arbat@apetite.ru"); admin = login("admin@apetite.ru"); user = login("user@apetite.ru")
BID = my_business(owner); OT = owner["accessToken"]; EMPTY_BID = my_business(other)

# ---------- API ----------
st, _ = api("GET", f"/businesses/{BID}/sales"); check("без токена — 401", st == 401, st)
st, _ = api("GET", f"/businesses/{BID}/sales", token=user["accessToken"]); check("покупатель — 403", st == 403, st)
st, _ = api("GET", f"/businesses/{BID}/sales", token=other["accessToken"]); check("владелец другого заведения — 403", st == 403, st)
st, _ = api("GET", f"/businesses/{BID}/sales", token=admin["accessToken"]); check("админ платформы видит любое заведение", st == 200, st)
for bad in ("5", "0", "-7", "abc", "90"):
    st, _ = api("GET", f"/businesses/{BID}/sales?days={bad}", token=OT); check(f"days={bad} — 400", st == 400, st)
st, d14 = api("GET", f"/businesses/{BID}/sales", token=OT); check("по умолчанию 14 дней", st == 200 and d14["days"] == 14 and len(d14["points"]) == 14, (st, d14.get("days")))
for n in (7, 14, 30):
    st, d = api("GET", f"/businesses/{BID}/sales?days={n}", token=OT)
    pts = d["points"]; dates = [p["date"] for p in pts]
    check(f"{n} дней: ровно {n} точек, даты подряд и по возрастанию", len(pts) == n and dates == sorted(set(dates)), dates[:3])
    sold = sum(p["completedRevenue"] + p["pendingRevenue"] for p in pts); orders = sum(p["completedOrders"] + p["pendingOrders"] for p in pts)
    check(f"{n} дней: итого = сумма по дням (проданное без отменённых)", d["totals"]["revenue"] == sold and d["totals"]["orders"] == orders, (d["totals"], sold, orders))
    check(f"{n} дней: «когда покупают» разложил ровно все проданные заказы", sum(h["orders"] for h in d["heat"]) == d["totals"]["orders"] and sum(h["revenue"] for h in d["heat"]) == d["totals"]["revenue"], d["heat"])
    check(f"{n} дней: четыре корзины в порядке «заранее → меньше часа»", [h["key"] for h in d["heat"]] == ["over4", "h2to4", "h1to2", "under1"])
st, d30 = api("GET", f"/businesses/{BID}/sales?days=30", token=OT); st, d7 = api("GET", f"/businesses/{BID}/sales?days=7", token=OT)
check("30 дней ≥ 14 ≥ 7 по выручке (периоды вложены)", d30["totals"]["revenue"] >= d14["totals"]["revenue"] >= d7["totals"]["revenue"], (d30["totals"], d14["totals"], d7["totals"]))
check("сравнение честное: 14 дн. сопоставимы (история 40 дн.), 30 дн. — нет (предыдущий период длиннее истории)", d14["comparable"] is True and d30["comparable"] is False, (d14.get("comparable"), d30.get("comparable")))
check("демо-история есть (иначе график пуст): выручка за 14 дней > 0", d14["totals"]["revenue"] > 0, "запустите prisma:seed:sales-history")
st, de = api("GET", f"/businesses/{EMPTY_BID}/sales?days=14", token=other["accessToken"])
check("заведение без продаж: нули, а не ошибка", st == 200 and de["totals"]["orders"] == 0 and len(de["points"]) == 14 and all(h["orders"] == 0 for h in de["heat"]), (st, de.get("totals")))

# ---------- UI ----------
rub = lambda kopecks: f"{round(kopecks / 100):,}".replace(",", " ") + " ₽"
norm = lambda t: re.sub(r"\s+", " ", t.replace(" ", " ").replace(" ", " ")).strip()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={"width": 1360, "height": 1100}, timezone_id="Europe/Moscow", locale="ru-RU"); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    def sign_in(sess):
        page.goto(ADMIN + "/login"); page.evaluate("([a, r]) => { localStorage.clear(); localStorage.setItem('apetite.admin.accessToken', a); localStorage.setItem('apetite.admin.refreshToken', r); }", [sess["accessToken"], sess["refreshToken"]])
    sign_in(owner); page.goto(ADMIN + "/analytics"); panel = page.get_by_test_id("sales-panel"); panel.wait_for(timeout=20000); page.wait_for_selector("[data-testid=sales-total]", timeout=15000)
    check("панель «Продажи» на странице «Аналитика»", panel.get_by_role("heading", name="Продажи").count() == 1)
    check("по умолчанию выбран период 14 дн., столбцов 14", panel.get_by_role("button", name="14 дн.").get_attribute("aria-pressed") == "true" and panel.locator(".sales-bar-btn").count() == 14)
    check("«Продано за 14 дн.» совпадает с API", norm(page.get_by_test_id("sales-total").inner_text()) == norm(rub(d14["totals"]["revenue"])), (page.get_by_test_id("sales-total").inner_text(), rub(d14["totals"]["revenue"])))
    check("сравнение с прошлым периодом показано в процентах", re.search(r"[↑↓] \d+%", page.get_by_test_id("sales-delta").inner_text()) is not None, page.get_by_test_id("sales-delta").inner_text())
    check("подпись про «ушло людям, а не в мусор»", "не в мусор" in panel.inner_text())
    labels = [panel.locator(".sales-bar-btn").nth(i).get_attribute("aria-label") for i in range(14)]
    check("у каждого столбца человеческая подпись: день, сумма, заказы", all(re.search(r"продано на .*₽, \d+ (заказ|заказа|заказов)", l or "") for l in labels), labels[:2])
    check("последний столбец помечен «сегодня»", "(сегодня)" in labels[-1])
    page.screenshot(path=f"{OUT}/admin_sales_desktop.png", full_page=True)
    # день по клику
    last = panel.locator(".sales-bar-btn").nth(12); last.click(); page.wait_for_timeout(200)
    ro = norm(page.get_by_test_id("sales-readout").inner_text())
    check("клик по дню: внизу подробности (продано, заказы)", "продано" in ro and "заказ" in ro, ro)
    check("столбец помечен нажатым", last.get_attribute("aria-pressed") == "true")
    last.click(); page.mouse.move(5, 5); page.wait_for_timeout(200); check("повторный клик (и курсор ушёл) снимает выбор — снова «Лучший день»", "Лучший день" in page.get_by_test_id("sales-readout").inner_text())
    # клавиатура
    panel.locator(".sales-bar-btn").nth(3).focus(); page.wait_for_timeout(150)
    check("фокус с клавиатуры показывает подробности дня", "продано" in page.get_by_test_id("sales-readout").inner_text())
    page.keyboard.press("Tab"); page.keyboard.press("Enter"); page.wait_for_timeout(150)
    check("Tab + Enter выбирает соседний день", panel.locator(".sales-bar-btn[aria-pressed=true]").count() == 1)
    # периоды
    panel.get_by_role("button", name="30 дн.").click(); page.wait_for_function("document.querySelectorAll('.sales-bar-btn').length === 30", timeout=8000)
    check("30 дн.: 30 столбцов, итог совпадает с API", norm(page.get_by_test_id("sales-total").inner_text()) == norm(rub(d30["totals"]["revenue"])), page.get_by_test_id("sales-total").inner_text())
    check("30 дн.: процента нет, вместо него объяснение (истории не хватает)", "%" not in page.get_by_test_id("sales-delta").inner_text() and "Сравнение появится" in page.get_by_test_id("sales-delta").inner_text(), page.get_by_test_id("sales-delta").inner_text())
    page.screenshot(path=f"{OUT}/admin_sales_30.png", full_page=True)
    panel.get_by_role("button", name="7 дн.").click(); page.wait_for_function("document.querySelectorAll('.sales-bar-btn').length === 7", timeout=8000)
    check("7 дн.: 7 столбцов, итог совпадает с API", norm(page.get_by_test_id("sales-total").inner_text()) == norm(rub(d7["totals"]["revenue"])), page.get_by_test_id("sales-total").inner_text())
    page.reload(); page.wait_for_selector("[data-testid=sales-total]", timeout=15000)
    check("выбранный период (7 дн.) запоминается после перезагрузки", page.get_by_test_id("sales-panel").get_by_role("button", name="7 дн.").get_attribute("aria-pressed") == "true" and page.locator(".sales-bar-btn").count() == 7)
    # когда покупают
    heat = page.get_by_test_id("sales-heat")
    check("«За сколько до конца самовывоза покупают»: 4 отрезка в легенде с процентами", heat.locator(".heat-legend li").count() == 4 and heat.locator(".heat-legend li", has_text="%").count() == 4)
    check("вывод про время покупки показан (заказов достаточно)", len(norm(page.get_by_test_id("sales-heat-insight").inner_text())) > 20 and "от 5 заказов" not in page.get_by_test_id("sales-heat-insight").inner_text(), page.get_by_test_id("sales-heat-insight").inner_text())
    # мобильная раскладка
    page.set_viewport_size({"width": 375, "height": 900}); page.wait_for_timeout(300)
    check("375px: нет горизонтальной прокрутки страницы", page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]"))
    check("375px: все столбцы кликабельны по размеру (≥ 10px шириной)", page.evaluate("[...document.querySelectorAll('.sales-bar-btn')].every(b => b.getBoundingClientRect().width >= 10)"))
    page.screenshot(path=f"{OUT}/admin_sales_mobile.png", full_page=True)
    # пустое заведение
    page.set_viewport_size({"width": 1360, "height": 1100}); sign_in(other); page.goto(ADMIN + "/analytics"); page.wait_for_selector("[data-testid=sales-total]", timeout=20000)
    check("заведение без продаж: сумма 0 ₽ и понятное пустое сообщение", norm(page.get_by_test_id("sales-total").inner_text()).startswith("0") and "заказов не было" in page.get_by_test_id("sales-readout").inner_text(), page.get_by_test_id("sales-readout").inner_text())
    check("…и «когда покупают» не рисует пустую полосу", page.get_by_test_id("sales-heat").locator(".heat-bar").count() == 0)
    page.screenshot(path=f"{OUT}/admin_sales_empty.png", full_page=True)
    check("нет JS-ошибок в кабинете", not errs, errs[:2])
    b.close()

print(f"\n{'FAILED: ' + str(len(fails)) if fails else 'ALL PASSED'}"); sys.exit(1 if fails else 0)
