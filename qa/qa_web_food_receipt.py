"""Сайт на РЕАЛЬНОМ backend: состав/аллергены до оплаты (карта, оформление, лента «в 1 клик») и подтверждение получения в билете.
Нужны backend :3000 с seed и web :5174 (WEB_URL). Вход — демо-аккаунт из prisma/seed.ts через форму сайта; только localhost.
Создаёт тестовый оффер «QA веб-состав …» и тестовые заказы. Запуск: python3 qa/qa_web_food_receipt.py"""
import json, os, re, sys, time, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

API = os.environ.get("API_URL", "http://localhost:3000/api/v1"); WEB = os.environ.get("WEB_URL", "http://localhost:5174")
OUT = os.environ.get("QA_OUT", "/tmp")
for u in (API, WEB):
    if urlparse(u).hostname not in ("localhost", "127.0.0.1", "::1"): sys.exit(f"Отказ: {u} — не локальный адрес.")
PASSWORD = os.environ.get("QA_PASSWORD", "password123")  # демо-аккаунты из prisma/seed.ts
BUSINESS, BUYER, ADMIN = os.environ.get("QA_BUSINESS", "cafe.pushkin@apetite.ru"), os.environ.get("QA_USER", "user@apetite.ru"), os.environ.get("QA_ADMIN", "admin@apetite.ru")
fails = []
def check(n, c, x=""):
    print(("PASS " if c else "FAIL ") + n + (" | " + str(x)[:300] if x and not c else ""))
    if not c: fails.append(n)
def api(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + token} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=20) as r: t = r.read().decode(); return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read().decode() or "null")
def login(email):
    st, d = api("POST", "/auth/login", {"identifier": email, "password": PASSWORD}); assert st in (200, 201), (email, st, d); return d["accessToken"]
owner, buyer, admin = login(BUSINESS), login(BUYER), login(ADMIN)
st, mine = api("GET", "/businesses/mine", token=owner); biz = mine[0] if isinstance(mine, list) else mine
iso = lambda dt: dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
now = datetime.now(timezone.utc); p_end = now + timedelta(hours=3)
TITLE = "QA веб-состав " + str(int(time.time()))
st, offer = api("POST", "/offers", {"businessId": biz["id"], "title": TITLE, "category": "FOOD", "originalPriceRub": 500, "baseDiscountPercent": 50, "weightKg": 0.3, "quantityTotal": 20,
    "pickupStart": iso(now - timedelta(minutes=30)), "pickupEnd": iso(p_end), "ingredients": "Тесто (пшеничная мука, вода), сыр моцарелла, томатный соус",
    "allergens": ["gluten", "milk"], "bestBefore": iso(p_end + timedelta(hours=4))}, owner); assert st in (200, 201), (st, offer)
def completed_order():
    st, o = api("POST", "/orders", {"offerId": offer["id"], "quantity": 1}, buyer); assert st in (200, 201), (st, o)
    st, c = api("PATCH", f"/orders/{o['id']}/complete", {"pickupCode": o["pickupCode"]}, admin); assert st == 200, (st, c); return o
o_yes, o_no = completed_order(), completed_order()
TIP = lambda s: s.replace("\xa0", " ")

def web_login(page):
    page.goto(WEB + "/login"); page.fill("#email", BUYER); page.fill("#password", PASSWORD); page.click("button[type=submit]"); page.wait_for_timeout(2500)

def axe(page, label):
    try:
        from axe_playwright_python.sync_playwright import Axe
    except ImportError: print("SKIP axe"); return
    bad = [v["id"] for v in Axe().run(page, options={"runOnly": {"type": "tag", "values": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]}}).response["violations"]]
    check(f"axe: {label} — 0 нарушений WCAG AA", not bad, bad)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1360, "height": 860}, locale="ru-RU"); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    web_login(page)

    # ───────── карта: лист оффера ─────────
    page.goto(WEB + "/home"); page.wait_for_selector(".leaflet-marker-icon", timeout=15000); page.wait_for_timeout(1000)
    pin = page.locator(f'.leaflet-marker-icon[title^="{TITLE}"]').first; pin.focus(); page.keyboard.press("Enter")  # в ленте только топ-16, на карте — все
    page.wait_for_selector(".offer-sheet"); sheet = page.locator(".offer-sheet")
    check("карта: в листе оффера блок «Состав и срок годности»", sheet.locator(".food-info").count() == 1 and "Тесто (пшеничная мука, вода), сыр моцарелла" in sheet.inner_text())
    check("карта: аллергены по именам списком и срок «Годен до»", sheet.locator(".food-info-chip").count() == 2 and "Глютен (злаки)" in sheet.inner_text() and "Молоко и лактоза" in sheet.inner_text() and "Годен до" in sheet.inner_text())
    page.screenshot(path=os.path.join(OUT, "web_food_sheet.png"))

    # ───────── оформление ─────────
    page.goto(WEB + f"/checkout/{offer['id']}"); page.wait_for_selector(".checkout-summary")
    T = page.inner_text(".checkout-summary")
    check("оформление: состав, аллергены и срок годности в сводке", "Тесто (пшеничная мука" in T and "Глютен (злаки)" in T and "Годен до" in T, T[:300])
    fi, pay = page.locator(".food-info").bounding_box(), page.locator(".checkout-submit").bounding_box()
    check("оформление: состав на странице до кнопки «Оплатить» (виден до оплаты)", fi and pay and (fi["y"] < pay["y"] or fi["x"] < pay["x"]))
    page.screenshot(path=os.path.join(OUT, "web_food_checkout.png")); axe(page, "оформление с составом")

    # ───────── лента «в 1 клик» (ответ карты подменён: один оффер с составом, один — старый без него) ─────────
    live = lambda id_, title, **o: {"id": id_, "businessId": biz["id"], "title": title, "category": "FOOD", "originalPrice": 40000, "discountedPrice": 20000, "discountPercent": 50, "baseDiscountPercent": 40,
        "quantityTotal": 5, "quantityLeft": 5, "weightKg": 1, "status": "ACTIVE", "imageUrl": None, "featured": False, "pickupStart": iso(now - timedelta(hours=1)), "pickupEnd": iso(now + timedelta(hours=3)),
        "createdAt": iso(now), "updatedAt": iso(now), "businessName": "Кафе QA", "businessAddress": "Невский, 1", "businessLat": 59.9, "businessLng": 30.3, "distanceKm": 0.5, **o}
    full_o = live("00000000-0000-4000-8000-000000000001", "Лента с составом", ingredients="Лаваш, курица", allergens=["gluten", "eggs"], allergensDeclared=True, bestBefore=iso(now + timedelta(hours=8)))
    old_o = live("00000000-0000-4000-8000-000000000002", "Лента без состава", ingredients=None, allergens=[], allergensDeclared=False, bestBefore=None)
    ctx2 = b.new_context(viewport={"width": 1360, "height": 860}, locale="ru-RU", reduced_motion="reduce"); pg = ctx2.new_page()
    def fake(route, request):
        if request.method == "OPTIONS": return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
        route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps([full_o, old_o]))
    ctx2.route("**/api/v1/offers/nearby**", fake); web_login(pg); pg.goto(WEB + "/"); pg.wait_for_selector(".offer-tile"); pg.wait_for_timeout(1200)
    tile = pg.locator(".offer-tile", has_text="Лента с составом").first
    check("лента: на плитке строка «Аллергены: глютен (злаки), яйца»", "Аллергены: глютен (злаки), яйца" in tile.inner_text(), tile.inner_text())
    check("лента: у оффера с составом доступно «Заказать в 1 клик»", pg.get_by_role("button", name=re.compile("Заказать в 1 клик: Лента с составом")).count() >= 1)
    legacy = pg.locator(".offer-tile", has_text="Лента без состава").first
    check("лента: у старого оффера без состава «в 1 клик» нет — «Смотреть и заказать» ведёт на оформление", "Состав и аллергены не указаны" in legacy.inner_text() and legacy.get_by_role("link", name="Смотреть и заказать").get_attribute("href") == "/checkout/" + old_o["id"] and legacy.get_by_role("button", name=re.compile("1 клик")).count() == 0, legacy.inner_text())
    pg.evaluate("localStorage.removeItem('apetite.web.oneClickConsent')")
    pg.get_by_role("button", name=re.compile("Заказать в 1 клик: Лента с составом")).first.click(); pg.wait_for_selector("[role=dialog]"); dlg = pg.locator("[role=dialog]")
    check("лента: диалог согласия показывает состав, аллергены и срок годности этого оффера", "Лаваш, курица" in dlg.inner_text() and "Глютен (злаки)" in dlg.inner_text() and "Годен до" in dlg.inner_text(), dlg.inner_text()[:300])
    pg.screenshot(path=os.path.join(OUT, "web_food_oneclick.png")); axe(pg, "диалог «в 1 клик» с составом"); ctx2.close()

    # ───────── подтверждение получения ─────────
    page.goto(WEB + "/orders"); page.wait_for_selector(".order-card"); page.wait_for_function("() => !document.querySelector('.order-card-title.is-loading')", timeout=8000)
    reminders_before = page.locator(".order-card-receipt").count()
    check("список заказов: у выданных и не подтверждённых заказов напоминание «Подтвердите получение» (минимум два наших)", reminders_before >= 2, reminders_before)
    page.goto(WEB + f"/orders/{o_yes['id']}"); page.wait_for_selector(".receipt-panel")
    check("билет выданного заказа: вопрос «Вы получили заказ?»", page.get_by_role("heading", name="Вы получили заказ?").count() == 1)
    page.screenshot(path=os.path.join(OUT, "web_receipt_question.png")); axe(page, "вопрос о получении")
    page.get_by_role("button", name="Да, получил").click(); page.wait_for_selector(".receipt-panel.is-done", timeout=8000)
    st, srv = api("GET", f"/orders/{o_yes['id']}", token=buyer)
    check("«Да, получил»: на экране «Получение подтверждено», на сервере receiptConfirmedAt", "Получение подтверждено" in page.inner_text(".receipt-panel") and srv["receiptConfirmedAt"] and not srv["receiptDisputedAt"], srv)
    page.reload(); page.wait_for_selector(".receipt-panel.is-done", timeout=8000); check("после перезагрузки подтверждение сохраняется", "Получение подтверждено" in page.inner_text(".receipt-panel"))

    page.goto(WEB + f"/orders/{o_no['id']}"); page.wait_for_selector(".receipt-panel")
    page.get_by_role("button", name="Нет, не получил").click()
    check("«Нет, не получил»: четыре причины, по умолчанию «Заказ не выдали», пока ничего не отправлено", page.get_by_role("radio").count() == 4 and page.get_by_role("radio", name="Заказ не выдали").is_checked() and api("GET", f"/orders/{o_no['id']}", token=buyer)[1]["receiptDisputedAt"] is None)
    page.screenshot(path=os.path.join(OUT, "web_receipt_dispute.png")); axe(page, "форма спора")
    page.get_by_role("radio", name="Проблема с качеством").check(); page.get_by_label(re.compile("Пояснение")).fill("Остыло и без начинки")
    page.get_by_role("button", name="Отправить").click(); page.wait_for_selector(".receipt-panel.is-disputed", timeout=8000)
    st, srv = api("GET", f"/orders/{o_no['id']}", token=buyer)
    check("спор: на экране «Обращение отправлено», на сервере причина QUALITY и пояснение", "Обращение отправлено" in page.inner_text(".receipt-panel") and srv["receiptDisputeReason"] == "QUALITY" and srv["receiptDisputeNote"] == "Остыло и без начинки", srv)
    page.goto(WEB + "/orders"); page.wait_for_selector(".order-card"); page.wait_for_timeout(800)
    check("после двух ответов напоминаний в списке ровно на два меньше", page.locator(".order-card-receipt").count() == reminders_before - 2, (reminders_before, page.locator(".order-card-receipt").count()))
    check("консоль без ошибок", not errs, errs[:3])
    ctx.close(); b.close()

st, d = api("DELETE", f"/offers/{offer['id']}", token=owner)
if st >= 400: api("PATCH", f"/offers/{offer['id']}", {"status": "ARCHIVED"}, owner)
print("\nFAILS:", fails); sys.exit(1 if fails else 0)
