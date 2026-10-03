import os
"""QA панелей бизнеса и платформы на замоканном API: сеть и пароли не нужны."""
import json, re, sys
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
NOW = datetime.now(timezone.utc)
iso = lambda mins: (NOW + timedelta(minutes=mins)).isoformat().replace("+00:00", "Z")
results = []
def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))

def state(role):
    offer = lambda i, title, status="ACTIVE": {"id": f"o{i}", "businessId": "biz-1", "title": title, "description": None, "category": "FOOD", "originalPrice": 60000, "discountedPrice": 30000, "discountPercent": 50, "baseDiscountPercent": 50, "imageUrl": None, "quantityTotal": 10, "quantityLeft": 6, "weightKg": 0.5, "pickupStart": iso(-30), "pickupEnd": iso(120), "status": status, "createdAt": iso(-100), "updatedAt": iso(-1)}
    return {
        "user": {"id": "ub", "email": "biz@example.test", "name": "Владелец", "role": role, "notifyRadiusKm": 5, "createdAt": iso(-9999), "updatedAt": iso(-1)},
        "offers": [offer(1, "Сет роллов дня"), offer(2, "Выпечка к закрытию"), offer(3, "Старый оффер", "ARCHIVED")],
        "orders": [{"id": "ord1", "userId": "u1", "offerId": "o1", "businessId": "biz-1", "quantity": 1, "totalPrice": 30000, "platformFee": 7500, "status": "CONFIRMED", "pickupCode": "123456", "createdAt": iso(-20)},
                   {"id": "ord2", "userId": "u1", "offerId": "o2", "businessId": "biz-1", "quantity": 2, "totalPrice": 60000, "platformFee": 15000, "status": "COMPLETED", "pickupCode": "654321", "createdAt": iso(-200)}],
        "businesses": [{"id": "biz-1", "ownerUserId": "ub", "name": "Кафе Пушкинъ", "description": None, "category": "FOOD", "address": "Невский 1", "lat": 59.9, "lng": 30.3, "status": "ACTIVE", "commissionPercent": 25, "logoUrl": None, "createdAt": iso(-9999), "updatedAt": iso(-1)}],
        "calls": [], "mode": {}}

def install(ctx, st):
    def handler(route, request):
        url, method = request.url, request.method
        path = re.sub(r"^https?://[^/]+/api/v1", "", url).split("?")[0]
        if method == "OPTIONS":
            return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
        st["calls"].append((method, path)); m = st["mode"]
        def ok(data, status=200): route.fulfill(status=status, content_type="application/json", body=json.dumps(data), headers={"access-control-allow-origin": "*"})
        if m.get("offline"): return route.abort("connectionrefused")
        if path == "/auth/me": return ok(st["user"])
        if path == "/auth/logout": return ok({"success": True})
        if path == "/auth/refresh":
            return ok({"statusCode": 401, "message": "x"}, 401) if m.get("refresh_fails") else ok({"accessToken": "a2", "refreshToken": "r2"}, 201)
        if path == "/businesses/mine": return ok(st["businesses"])
        if path == "/businesses/biz-1/stats": return ok({"activeOffersCount": 2, "totalOrders": 2, "confirmedOrders": 1, "completedOrders": 1, "cancelledOrders": 0, "expiredOrders": 0, "revenue": 60000, "platformFee": 15000, "weightSavedKg": 1.0})
        if path == "/offers" and method == "GET":
            if m.get("expire_offers_once") and not m.get("_e"): m["_e"] = True; return ok({"statusCode": 401, "message": "expired"}, 401)
            return ok({"items": st["offers"], "total": len(st["offers"]), "page": 1, "pageSize": 50})
        if path == "/offers" and method == "POST":
            body = json.loads(request.post_data or "{}")
            if m.get("create_fails"): return ok({"statusCode": 400, "message": ["Цена должна быть больше нуля"]}, 400)
            o = {"id": f"o{len(st['offers'])+1}", "businessId": "biz-1", **body, "originalPrice": int(body.get("originalPriceRub", 0) * 100), "discountedPrice": 0, "discountPercent": body.get("baseDiscountPercent", 50), "quantityLeft": body.get("quantityTotal", 1), "status": "ACTIVE", "createdAt": iso(0), "updatedAt": iso(0), "imageUrl": None}
            st["offers"].insert(0, o); return ok(o, 201)
        mo = re.match(r"^/offers/([^/]+)$", path)
        if mo and method in ("PATCH", "DELETE"):
            o = next((x for x in st["offers"] if x["id"] == mo.group(1)), None)
            if method == "DELETE": st["offers"] = [x for x in st["offers"] if x["id"] != mo.group(1)]; return ok({"success": True})
            o.update(json.loads(request.post_data or "{}")); return ok(o)
        if path == "/orders" and method == "GET": return ok(st["orders"])
        mo = re.match(r"^/orders/([^/]+)/complete$", path)
        if mo:
            body = json.loads(request.post_data or "{}"); o = next(x for x in st["orders"] if x["id"] == mo.group(1))
            if body.get("pickupCode") != o["pickupCode"]: return ok({"statusCode": 400, "message": "Неверный код выдачи"}, 400)
            o["status"] = "COMPLETED"; return ok(o)
        if path == "/platform/businesses": return ok([{"id": "biz-1", "name": "Кафе Пушкинъ", "category": "FOOD", "status": st["businesses"][0]["status"], "commissionPercent": 25, "address": "Невский 1", "ordersCompleted": 1, "revenue": 60000, "platformFee": 15000, "createdAt": iso(-9999)}])
        if path == "/platform/stats": return ok({"businessesTotal": 3, "businessesActive": 2, "businessesSuspended": 1, "businessesPending": 0, "activeOffersCount": 4, "totalOrders": 10, "confirmedOrders": 2, "completedOrders": 6, "cancelledOrders": 1, "expiredOrders": 1, "gmv": 1234500, "platformRevenue": 308600, "weightSavedKg": 12.5})
        mo = re.match(r"^/businesses/([^/]+)$", path)
        if mo and method == "PATCH":
            body = json.loads(request.post_data or "{}"); st["businesses"][0].update(body); return ok(st["businesses"][0])
        return ok({"statusCode": 404, "message": f"unmocked {method} {path}"}, 404)
    ctx.route("**/api/v1/**", handler)

def open_panel(b, role, vp, path, st=None):
    ctx = b.new_context(viewport=vp, locale="ru-RU"); st = st or state(role); dialogs = []
    ctx.add_init_script("localStorage.setItem('apetite.admin.accessToken','fake.a'); localStorage.setItem('apetite.admin.refreshToken','fake.r');")
    install(ctx, st); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(m.text[:140]) if m.type == "error" and not re.search("Failed to load resource|ERR_CONNECTION", m.text) else None)
    def on_dialog(d): dialogs.append(d.message); d.accept() if st["mode"].get("accept_dialogs", True) else d.dismiss()
    page.on("dialog", on_dialog)
    page.goto(BASE + path, wait_until="networkidle"); page.wait_for_timeout(900)
    return ctx, page, st, errs, dialogs
D = {"width": 1414, "height": 900}; PH = {"width": 390, "height": 844}
body = lambda page: page.inner_text("body")

with sync_playwright() as p:
    b = getattr(p, os.environ.get("QA_BROWSER", "chromium")).launch()
    ctx, page, st, errs, dialogs = open_panel(b, "BUSINESS", D, "/offers")
    T = body(page)
    check("[biz] Офферы: таблица с офферами и статусами", all(x in T for x in ["Сет роллов дня", "Выпечка к закрытию", "Старый оффер"]), T[:120])
    check("[biz] нет пунктов платформы в меню владельца заведения", "Заведения" not in page.locator("nav, aside").first.inner_text() if page.locator("nav, aside").count() else True)
    check("[biz] у всех полей формы быстрого создания есть label", page.evaluate("[...document.querySelectorAll('input,select,textarea')].every(i => i.getAttribute('aria-label') || (i.id && document.querySelector('label[for=\"'+i.id+'\"]')) || i.closest('label'))"))
    page.get_by_role("button", name=re.compile("Новый оффер")).click(); page.wait_for_timeout(500)
    check("[biz] «Новый оффер» открывает модалку", page.locator("#title").is_visible())
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check("[biz] Escape закрывает модалку", not page.locator("#title").is_visible())
    page.get_by_role("button", name=re.compile("Новый оффер")).click(); page.wait_for_timeout(400)
    page.locator("#title").fill("Тестовый оффер"); page.locator("#weight").fill("0.5"); page.locator("#price").fill("0")
    page.locator("form").last.evaluate("f => f.requestSubmit()"); page.wait_for_timeout(500)
    check("[biz] цена 0 не проходит валидацию (POST не ушёл)", ("POST", "/offers") not in st["calls"])
    page.locator("#price").fill("800")
    start = page.locator("#pickupStart").input_value(); page.locator("#pickupEnd").fill(start[:11] + "00:01" if start[11:16] > "00:01" else start)
    page.locator("form").last.evaluate("f => f.requestSubmit()"); page.wait_for_timeout(700)
    check("[biz] окно самовывоза с концом раньше начала не отправляется, ошибка видна", ("POST", "/offers") not in st["calls"] and "должен быть позже начала" in body(page), "форма отправила оффер с pickupEnd < pickupStart")
    page.locator("#pickupEnd").fill(start[:11] + "23:59" if start[11:16] < "23:59" else start)
    page.locator("form").last.evaluate("f => f.requestSubmit()"); page.wait_for_timeout(900)
    check("[biz] валидная форма создаёт оффер (POST) и он появляется в списке", ("POST", "/offers") in st["calls"] and "Тестовый оффер" in body(page), str(st["calls"][-4:]))
    st["mode"]["create_fails"] = True
    page.get_by_role("button", name=re.compile("Новый оффер")).click(); page.wait_for_timeout(400)
    page.locator("#title").fill("Сломанный"); page.locator("#weight").fill("0.5"); page.locator("#price").fill("500"); page.locator("form").last.evaluate("f => f.requestSubmit()"); page.wait_for_timeout(900)
    check("[biz] ошибка сервера при создании показана в модалке", "Цена должна быть больше нуля" in body(page), body(page)[-160:].replace("\n", " "))
    page.keyboard.press("Escape"); st["mode"]["create_fails"] = False
    # архив / удаление через confirm
    row = page.locator("tr").filter(has_text="Сет роллов дня").first
    archive = row.get_by_role("button", name=re.compile("Архив", re.I))
    if archive.count():
        st["mode"]["accept_dialogs"] = False; archive.click(); page.wait_for_timeout(500)
        check("[biz] отказ в confirm не архивирует оффер", not any(c[0] == "PATCH" and c[1] == "/offers/o1" for c in st["calls"]))
        st["mode"]["accept_dialogs"] = True; archive.click(); page.wait_for_timeout(700)
        check("[biz] подтверждение confirm архивирует оффер (PATCH)", any(c[0] == "PATCH" and c[1] == "/offers/o1" for c in st["calls"]))
    else: check("[biz] кнопка «Архив» найдена", False)
    page.goto(BASE + "/orders", wait_until="networkidle"); page.wait_for_timeout(700)
    check("[biz] Заказы: у поля кода выдачи есть доступное имя", page.get_by_label("Код выдачи").count() >= 1)
    code = page.get_by_label("Код выдачи").first; btn = page.get_by_role("button", name="Выдать").first
    check("[biz] «Выдать» заблокирована, пока код не из 6 цифр", btn.is_disabled())
    code.fill("12ab34"); check("[biz] в код выдачи нельзя ввести буквы", code.input_value() == "1234", code.input_value())
    code.fill("000000"); btn.click(); page.wait_for_timeout(700)
    check("[biz] неверный код -> ошибка в строке, статус не меняется", "Неверный код выдачи" in body(page) and st["orders"][0]["status"] == "CONFIRMED")
    code.fill("123456"); btn.click(); page.wait_for_timeout(900)
    check("[biz] верный код -> заказ выдан (PATCH complete)", st["orders"][0]["status"] == "COMPLETED")
    page.goto(BASE + "/analytics", wait_until="networkidle"); page.wait_for_timeout(800)
    T = body(page); check("[biz] Аналитика: выручка и заказы отображаются", "600" in T and re.search("Выруч", T) is not None, T[:160].replace("\n", " "))
    page.goto(BASE + "/platform/businesses", wait_until="networkidle"); page.wait_for_timeout(600)
    check("[biz] владелец заведения не попадает на страницы платформы", "/platform" not in page.url or "Кафе Пушкинъ" not in body(page), page.url)
    page.get_by_role("button", name=re.compile("Выйти")).click() if page.get_by_role("button", name=re.compile("Выйти")).count() else None
    page.wait_for_timeout(700)
    check("[biz] выход возвращает на /login и чистит токены", page.url.endswith("/login") and page.evaluate("localStorage.getItem('apetite.admin.accessToken')") is None, page.url)
    check("[biz] нет JS-ошибок за сессию", not errs, str(errs[:3])); ctx.close()

    ctx, page, st, errs, dialogs = open_panel(b, "ADMIN", D, "/platform/businesses"); T = body(page)
    check("[admin] Заведения: таблица с комиссией и выручкой", "Кафе Пушкинъ" in T and "25" in T, T[:120])
    st["mode"]["accept_dialogs"] = True
    susp = page.get_by_role("button", name=re.compile("Приостановить|Заблок|Suspend", re.I))
    if susp.count():
        susp.first.click(); page.wait_for_timeout(700)
        check("[admin] приостановка заведения уходит PATCH-ем после confirm", any(c[0] == "PATCH" and c[1] == "/businesses/biz-1" for c in st["calls"]))
    else: check("[admin] кнопка приостановки найдена", False)
    page.goto(BASE + "/platform/stats", wait_until="networkidle"); page.wait_for_timeout(800); T = body(page)
    check("[admin] GMV: 12 345 ₽ и доход платформы 3 086 ₽", re.search("12\\s?345", T) is not None and re.search("3\\s?086", T) is not None, T[:200].replace("\n", " "))
    check("[admin] нет JS-ошибок", not errs, str(errs[:3])); ctx.close()

    st = state("BUSINESS"); st["mode"]["expire_offers_once"] = True
    ctx, page, st, errs, dialogs = open_panel(b, "BUSINESS", D, "/offers", st)
    check("[401] протухший токен: refresh и повтор запроса, список загрузился", ("POST", "/auth/refresh") in st["calls"] and "Сет роллов дня" in body(page), str(st["calls"][:8])); ctx.close()
    st = state("BUSINESS"); st["mode"]["offline"] = True
    ctx, page, st, errs, dialogs = open_panel(b, "BUSINESS", D, "/offers", st)
    T = body(page)
    check("[offline] при старте без сети сессия не стирается", page.evaluate("localStorage.getItem('apetite.admin.accessToken')") == "fake.a", str(page.evaluate("localStorage.getItem('apetite.admin.accessToken')")))
    check("[offline] пользователь видит понятное сообщение, а не «Failed to fetch»", "Failed to fetch" not in T and "Нет соединения" in T, T[:200].replace("\n", " ")); ctx.close()

    for label, vp in [("phone", PH), ("tablet", {"width": 768, "height": 1024}), ("desktop", D)]:
        for path, role in [("/offers", "BUSINESS"), ("/orders", "BUSINESS"), ("/analytics", "BUSINESS"), ("/platform/businesses", "ADMIN"), ("/platform/stats", "ADMIN")]:
            ctx, page, st, errs, dialogs = open_panel(b, role, vp, path)
            ov = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
            wide = page.evaluate("[...document.querySelectorAll('table')].some(t => t.getBoundingClientRect().right > innerWidth + 1 && !t.closest('[style*=overflow], .table-wrap, .table-scroll'))")
            check(f"[layout {label}] {path}: нет горизонтального переполнения страницы", not ov, "page scrolls sideways" if ov else "")
            ctx.close()
    b.close()
print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
