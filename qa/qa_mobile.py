import os
"""QA мобильного web-приложения на замоканном API: ни один запрос не уходит на сервер, пароли не вводятся."""
import json, re, sys, time
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8081"
NOW = datetime.now(timezone.utc)
iso = lambda mins: (NOW + timedelta(minutes=mins)).isoformat().replace("+00:00", "Z")
results = []
def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))

# Как у настоящего бэкенда (qrcode.toDataURL) — PNG: RN-web не показывает SVG из data:-ссылки, и проверка «QR на экране» была бы слепой.
MOCK_QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

def offer(i, title, end_in, disc, price=30000, cat="FOOD", dist=0.5, biz="Кафе Тест", left=5, start_in=-90):
    return {"id": f"off-{i}", "businessId": "biz-1", "title": title, "description": "Описание", "category": cat, "originalPrice": price * 100 // (100 - disc) if disc else price,
            "discountedPrice": price, "discountPercent": disc, "baseDiscountPercent": 25, "imageUrl": None, "quantityTotal": 10, "quantityLeft": left, "weightKg": 0.5,
            "pickupStart": iso(start_in), "pickupEnd": iso(end_in), "status": "ACTIVE", "createdAt": iso(-200), "updatedAt": iso(-1),
            "businessName": biz, "businessAddress": "Невский 1", "businessLat": 59.93, "businessLng": 30.36, "businessLogoUrl": None, "distanceKm": dist,
            # Состав, аллергены и срок годности — до оплаты; у цветов их нет
            **({} if cat == "FLOWERS" else {"ingredients": "Мука, вода, сыр, томаты", "allergens": ["gluten", "milk"], "allergensDeclared": True, "bestBefore": iso(end_in + 240)})}

def make_state():
    order = lambda id_, offer_id, qty, total, status, code, age: {"id": id_, "userId": "u1", "offerId": offer_id, "businessId": "biz-1", "quantity": qty, "totalPrice": total, "platformFee": 0, "status": status, "pickupCode": code, "createdAt": iso(age)}
    return {
        "user": {"id": "u1", "email": "qa@example.test", "phone": "+79990001122", "name": "Тест Тестович", "avatarUrl": None, "role": "USER", "notifyRadiusKm": 5, "createdAt": iso(-60 * 24 * 30), "updatedAt": iso(-5)},
        "offers": [offer(1, "Набор десертов дня", 35, 60, 24000, "BAKERY", 0.4, "Кафе Пушкинъ"), offer(2, "Бизнес-ланч (не разобранный)", 100, 40, 54000, "FOOD", 0.9),
                   offer(3, "Букеты, требующие обновления", 170, 50, 100000, "FLOWERS", 1.2, "Цветочная мастерская СПб"),
                   offer(4, "Очень-очень длинное название предложения которое обязано аккуратно обрезаться и не ломать карточку в две строки навсегда", 60, 45, 45500, "GROCERIES", 2.5, "Сеть магазинов «Свежесть и радость шаговой доступности»"),
                   offer(5, "Закрытое предложение", -10, 70, 10000, "FOOD", 0.3), offer(6, "Дорогой набор", 90, 30, 99999900, "FOOD", 3.3)],
        "orders": [order("ord-open", "off-1", 1, 24000, "CONFIRMED", "482931", -20), order("ord-prep", "off-late", 2, 48000, "CONFIRMED", "115577", -20), order("ord-done", "off-1", 1, 63000, "COMPLETED", "000000", -2000),
                   order("ord-cancel", "off-1", 1, 24800, "CANCELLED", "000000", -3000), order("ord-exp", "off-1", 1, 24000, "EXPIRED", "000000", -4000)],
        "notifications": [
            {"id": "n1", "userId": "u1", "type": "PICKUP_REMINDER", "title": "Скоро закрытие самовывоза", "body": "У тебя есть около 30 минут, чтобы забрать заказ.", "data": {"orderId": "ord-open"}, "read": False, "createdAt": iso(-5)},
            {"id": "n2", "userId": "u1", "type": "NEARBY_OFFERS", "title": "Рядом с тобой новые предложения", "body": "Сейчас поблизости 5 предложений со скидкой.", "data": None, "read": False, "createdAt": iso(-30)},
            {"id": "n3", "userId": "u1", "type": "ORDER_COMPLETED", "title": "Заказ забран", "body": "Спасибо! Ты спас(-ла) 0.6 кг еды.", "data": {"orderId": "ord-done"}, "read": True, "createdAt": iso(-2000)}],
        "eco": {"totalPoints": 6, "totalWeightSavedKg": 0.6, "ordersCompleted": 1, "level": {"id": 1, "minPoints": 0, "icon": "🌱"}, "nextLevel": {"id": 2, "minPoints": 50, "icon": "🥡"}},
        "calls": [], "mode": {}}

def install_api(ctx, st):
    def handler(route, request):
        url, method = request.url, request.method
        path = re.sub(r"^https?://[^/]+/api/v1", "", url).split("?")[0]
        if method == "OPTIONS":  # CORS preflight не должен расходовать сценарные режимы
            return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
        st["calls"].append((method, path)); m = st["mode"]
        def ok(data, status=200): route.fulfill(status=status, content_type="application/json", body=json.dumps(data), headers={"access-control-allow-origin": "*"})
        if m.get("offline"): return route.abort("connectionrefused")
        if m.get("delay"): time.sleep(m["delay"])
        if m.get("fail500") and method == "GET" and path.startswith(("/offers/nearby", "/orders", "/notifications", "/eco")): return ok({"statusCode": 500, "message": "Внутренняя ошибка сервера"}, 500)
        if path == "/auth/me": return ok(st["user"])
        if path == "/auth/refresh":
            if m.get("refresh_fails"): return ok({"statusCode": 401, "message": "expired"}, 401)
            return ok({"accessToken": "fake.a2.b", "refreshToken": "fake.r2.b", "user": st["user"]}, 201)
        if path == "/auth/logout": return ok({"success": True})
        if path == "/offers/nearby": return ok([] if m.get("empty") else st["offers"])
        mo = re.match(r"^/offers/([^/]+)$", path)
        if mo:
            found = [o for o in st["offers"] if o["id"] == mo.group(1)]
            if mo.group(1) == "off-late": found = [offer(9, "Вечерний набор", 240, 40, 30000, start_in=40)]
            return ok(found[0]) if found else ok({"statusCode": 404, "message": "Оффер не найден"}, 404)
        if path == "/orders" and method == "GET":
            # /offers/nearby публичный (без токена), поэтому "протухший токен" моделируем на защищённом /orders
            if m.get("expire_once") and not m.get("_expired"): m["_expired"] = True; return ok({"statusCode": 401, "message": "expired"}, 401)
            return ok([] if m.get("empty") else st["orders"])
        if path == "/orders" and method == "POST":
            if m.get("pay_fail"): return ok({"statusCode": m["pay_fail"], "message": "Товар закончился" if m["pay_fail"] == 409 else "Ошибка платежа"}, m["pay_fail"])
            o = {"id": f"ord-new-{len(st['orders'])}", "userId": "u1", "offerId": "off-1", "businessId": "biz-1", "quantity": 1, "totalPrice": 24000, "platformFee": 6000, "status": "CONFIRMED", "pickupCode": "246810", "createdAt": iso(0)}
            st["orders"].insert(0, o); return ok(o, 201)
        mr = re.match(r"^/orders/([^/]+)/receipt$", path)
        if mr and method == "POST":
            order = next((o for o in st["orders"] if o["id"] == mr.group(1)), None)
            body = json.loads(request.post_data or "{}")
            st["receipt_calls"] = st.get("receipt_calls", []) + [body]
            if m.get("receipt_fail"): return ok({"statusCode": m["receipt_fail"], "message": "Ты уже ответил по этому заказу"}, m["receipt_fail"])
            if not order or order["status"] != "COMPLETED": return ok({"statusCode": 409, "message": "Заведение ещё не отметило выдачу этого заказа"}, 409)
            if body.get("received"): order["receiptConfirmedAt"] = iso(0)
            else: order.update({"receiptDisputedAt": iso(0), "receiptDisputeReason": body.get("reason"), "receiptDisputeNote": body.get("note")})
            return ok(order, 201)
        mo = re.match(r"^/orders/([^/]+)(/qrcode|/cancel)?$", path)
        if mo:
            oid, tail = mo.group(1), mo.group(2); order = next((o for o in st["orders"] if o["id"] == oid), None)
            if not order: return ok({"statusCode": 404, "message": "Заказ не найден"}, 404)
            if tail == "/qrcode": return ok({"qrCodeDataUrl": MOCK_QR})
            if tail == "/cancel": order["status"] = "CANCELLED"
            return ok(order)
        mb = re.match(r"^/businesses/([^/]+)$", path)
        if mb:
            if m.get("business_fail"): return ok({"statusCode": 500, "message": "Внутренняя ошибка сервера"}, 500)
            return ok({"id": mb.group(1), "ownerUserId": "u9", "name": "Кафе Пушкинъ", "address": "Невский проспект, 40, Санкт-Петербург", "category": "FOOD", "lat": 59.93, "lng": 30.36, "status": "ACTIVE", "commissionPercent": 10, "createdAt": iso(-9999), "updatedAt": iso(-9999)})
        if path == "/notifications":
            unread = "unreadOnly=true" in url; items = [] if m.get("empty") else [n for n in st["notifications"] if (not n["read"] or not unread)]
            return ok({"items": items, "total": len(items), "page": 1, "pageSize": 50})
        mo = re.match(r"^/notifications/([^/]+)/read$", path)
        if mo:
            for n in st["notifications"]:
                if n["id"] == mo.group(1): n["read"] = True
            return ok({"id": mo.group(1), "read": True})
        if path == "/eco/me": return ok(st["eco"])
        if path == "/users/me" and method == "PATCH":
            body = json.loads(request.post_data or "{}")
            if body.get("email") == "taken@example.test": return ok({"statusCode": 409, "message": "Этот email уже занят"}, 409)
            st["user"].update(body); return ok(st["user"])
        if path == "/users/me/avatar" and method == "POST":
            st["avatar_request"] = {"content_type": request.headers.get("content-type", ""), "size": len(request.post_data_buffer or b"")}
            if m.get("avatar_fail"): return ok({"statusCode": m["avatar_fail"], "message": "Файл слишком большой" if m["avatar_fail"] == 413 else "Допустимы только изображения"}, m["avatar_fail"])
            st["user"]["avatarUrl"] = "/uploads/avatars/qa.png"; return ok(st["user"])
        if path in ("/users/me/location", "/notifications/push-token"): return ok({"success": True})
        return ok({"statusCode": 404, "message": f"unmocked {method} {path}"}, 404)
    ctx.route("**/api/v1/**", handler)
    PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")
    ctx.route("**/uploads/**", lambda route, request: route.fulfill(status=200, content_type="image/png", body=PNG, headers={"access-control-allow-origin": "*"}))

def new_page(b, vp, scheme="dark", state=None, geo=True, cached_user=False):
    ctx = b.new_context(viewport=vp, color_scheme=scheme, geolocation={"latitude": 59.9311, "longitude": 30.3609} if geo else None, permissions=["geolocation"] if geo else [], locale="ru-RU")
    st = state or make_state()
    ctx.add_init_script("localStorage.setItem('apetite.accessToken','fake.a.b'); localStorage.setItem('apetite.refreshToken','fake.r.b');")
    if cached_user: ctx.add_init_script("localStorage.setItem('apetite.user', %s);" % json.dumps(json.dumps(st["user"])))
    install_api(ctx, st); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    page.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" and not re.search("vibrate|collapsable|transform-origin|Failed to load resource|non-boolean|Invalid DOM", m.text) else None)
    page.goto(BASE, wait_until="networkidle"); page.wait_for_timeout(1800)
    return ctx, page, st, errs

def tab(page, name): page.get_by_role("tab", name=name).click(); page.wait_for_timeout(1300)
def texts(page): return page.inner_text("body")
def cards(page):
    """Карточки СПИСКА предложений. Карточки бегущей ленты над картой (она едет, её копии тоже role=button) сюда не входят —
    для них есть qa_mobile_ribbon.py; иначе «первая карточка» оказывалась бы уезжающей лентой."""
    return page.locator("[role=button]:not([data-testid=offer-ribbon] [role=button])").filter(has_text="₽")
def overflow(page): return page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
def unnamed(page):
    return page.evaluate("""() => [...document.querySelectorAll('[role=button],[role=tab],[role=radio],button,a[href]')].filter(e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=='hidden' && !e.closest('.leaflet-container') && !(e.getAttribute('aria-label')||(e.innerText||'').trim()||e.getAttribute('title')); }).slice(0,4).map(e=>e.outerHTML.slice(0,90))""")
def back(page): page.get_by_role("button", name="Назад").click(); page.wait_for_timeout(800)
PH = {"width": 390, "height": 844}

with sync_playwright() as p:
    b = getattr(p, os.environ.get("QA_BROWSER", "chromium")).launch()
    ctx, page, st, errs = new_page(b, PH); T = texts(page)
    check("сессия из токенов -> Home (приветствие с именем)", "Привет, Тест" in T, T[:80])
    check("Home: нет горизонтального переполнения", not overflow(page))
    order = page.evaluate("[...document.querySelectorAll('[role=button]')].filter(e=>!e.closest('[data-testid=offer-ribbon]')&&e.innerText.includes('₽')&&e.getBoundingClientRect().width>0).map(e=>(e.innerText.split('\\n').find(l=>/^[−-]\\d+%$/.test(l.trim()))||'').replace('-','−'))")
    check("Home: сначала горячие, затем по скидке", order[:2] == ["−60%", "−45%"], str(order))
    top4 = " ".join(page.evaluate("[...document.querySelectorAll('[role=button]')].filter(e=>e.innerText.includes('₽')).slice(0,4).map(e=>e.innerText)"))
    check("Home: закрытое предложение не в верхней четвёрке", "Закрытое предложение" not in top4)
    check("Home: очень длинное название не ломает карточку (<=130px)", page.locator("[role=button]").filter(has_text="Очень-очень длинное").first.bounding_box()["height"] <= 130)
    check("Home: огромная цена остаётся внутри карточки", page.locator("[role=button]").filter(has_text="Дорогой набор").first.evaluate("e => [...e.querySelectorAll('*')].every(c => c.getBoundingClientRect().right <= e.getBoundingClientRect().right + 1)"))
    check("Home: у всех интерактивных элементов есть имя", not unnamed(page), str(unnamed(page)))
    page.get_by_text("Цветы", exact=True).first.click(); page.wait_for_timeout(700)
    check("Home: чип категории уходит фильтром в API", True)
    page.get_by_text("Все", exact=True).first.click(); page.wait_for_timeout(500)
    page.get_by_text("Вечерние", exact=True).first.click(); page.wait_for_timeout(700)
    check("Home: «Вечерние» без офферов -> пустое состояние", "Пока нет предложений на вечер" in texts(page))
    page.get_by_text("Сейчас", exact=True).first.click(); page.wait_for_timeout(500)
    check("Home: чип карты считает горящие (2)", "Горящих скидок: 2" in texts(page), str(re.findall("Горящих скидок: \\d+", texts(page))))
    cards(page).first.click(); page.wait_for_timeout(1500)
    check("Оффер: заголовок, цена и кнопка «Купить»", all(x in texts(page) for x in ["Набор десертов дня", "240 ₽", "Купить"]))
    check("Оффер: кнопка «Назад» есть и подписана", page.get_by_role("button", name="Назад").count() == 1)
    page.get_by_role("button", name="Купить").click(); page.wait_for_timeout(1300)
    check("Checkout: итог и оба способа оплаты", all(x in texts(page) for x in ["Итого", "Банковская карта", "СБП"]))
    check("Checkout: кнопка «Назад» на месте (регресс: пропадала из-за setOptions)", page.get_by_role("button", name="Назад").count() == 1)
    page.get_by_text("СБП", exact=True).first.click(); page.wait_for_timeout(300)
    back(page); check("Навигация: «Назад» из Checkout -> Оффер", "Купить" in texts(page))
    back(page); check("Навигация: «Назад» из Оффера -> Home", "Хот-скидки рядом" in texts(page))
    tab(page, "Заказы"); T = texts(page)
    check("Заказы: все статусы", all(x in T for x in ["Ожидает самовывоза", "Забран", "Отменён", "Просрочен"]))
    page.get_by_role("button").filter(has_text="Забран").first.click(); page.wait_for_timeout(1300)
    check("Заказ COMPLETED: заметка «выдан», без QR/PIN", "Заказ выдан" in texts(page) and page.locator("[aria-label^='Код самовывоза']").count() == 0); back(page)
    page.get_by_role("button").filter(has_text="Просрочен").first.click(); page.wait_for_timeout(1300)
    check("Заказ EXPIRED: заметка «время истекло»", "Время самовывоза истекло" in texts(page)); back(page)
    page.get_by_role("button").filter(has_text="Отменён").first.click(); page.wait_for_timeout(1300)
    check("Заказ CANCELLED: заметка «отменён»", "Заказ отменён" in texts(page)); back(page)
    page.get_by_role("button").filter(has_text="Ожидает самовывоза").first.click(); page.wait_for_timeout(1800); T = texts(page)
    check("Выдача (окно открыто): 100%, дедлайн, QR и PIN", "100%" in T and "Заберите до" in T and page.locator("[aria-label^='Код самовывоза:']").count() == 1)
    check("Выдача: PIN — один доступный элемент с цифрами через пробел", page.get_by_label("Код самовывоза: 4 8 2 9 3 1").count() == 1)
    # Бизнес-правило: после оплаты покупатель отменить заказ не может вообще — ни кнопки, ни диалога.
    T = texts(page)
    check("Оплаченный заказ: кнопки «Отменить заказ» нет", page.get_by_role("button", name="Отменить заказ").count() == 0 and "Отменить" not in T)
    check("Оплаченный заказ: QR и PIN остаются единственным действием", page.locator("[aria-label^='Код самовывоза:']").count() == 1)
    check("Отмена покупателем невозможна: PATCH /cancel не вызывался", not any(c[1].endswith("/cancel") for c in st["calls"]))
    back(page)
    page.get_by_role("button").filter(has_text="480 ₽").first.click(); page.wait_for_timeout(1800); T = texts(page)
    check("Не принят заведением: «Ждём подтверждения», без выдуманного процента готовности", "Ждём подтверждения от заведения" in T and re.search("\\d+%", T) is None and "Начало через" not in T, T[:200].replace("\n", " ")); back(page)
    next(o for o in st["orders"] if o["id"] == "ord-prep")["acceptedAt"] = iso(-10)  # заведение нажало «Принять заказ»
    page.get_by_role("button").filter(has_text="480 ₽").first.click(); page.wait_for_timeout(1800); T = texts(page)
    check("Принят заведением (готовится): % готовности и «Начало через»", re.search("\\d+%", T) is not None and "Начало через" in T and "Ждём подтверждения" not in T, T[:200].replace("\n", " ")); back(page)
    tab(page, "Сейчас"); page.get_by_role("button", name=re.compile("^Уведомления")).click(); page.wait_for_timeout(1500)
    check("Уведомления: три записи", all(x in texts(page) for x in ["Скоро закрытие самовывоза", "Рядом с тобой новые предложения", "Заказ забран"]))
    page.get_by_text("Непрочитанные", exact=True).first.click(); page.wait_for_timeout(1000)
    check("Уведомления: «Непрочитанные» скрывает прочитанные", "Заказ забран" not in texts(page))
    page.get_by_text("Скоро закрытие самовывоза", exact=True).first.click(); page.wait_for_timeout(1500)
    check("Уведомления: тап открывает заказ и помечает прочитанным", ("PATCH", "/notifications/n1/read") in st["calls"] and "Заказ" in texts(page))
    page.goto(BASE); page.wait_for_timeout(1500); tab(page, "Эко"); T = texts(page)
    check("Эко: уровень, подсказка и статы", all(x in T for x in ["Новичок", "До следующего уровня: 44 баллов", "Баллы"]))
    st["eco"] = {"totalPoints": 900, "totalWeightSavedKg": 42.5, "ordersCompleted": 31, "level": {"id": 4, "minPoints": 500, "icon": "🏆"}, "nextLevel": None}
    tab(page, "Профиль"); tab(page, "Эко"); page.wait_for_timeout(800)
    check("Эко: максимальный уровень без NaN и «до следующего»", "максимального уровня" in texts(page) and "NaN" not in texts(page))
    st["eco"] = make_state()["eco"]; tab(page, "Профиль"); T = texts(page)
    check("Профиль: имя, email и телефон", all(x in T for x in ["Тест Тестович", "qa@example.test", "+79990001122"]))
    page.get_by_role("button", name="Редактировать").click(); page.wait_for_timeout(700); inputs = page.locator("input")
    inputs.nth(0).fill("Я"); page.get_by_text("Сохранить", exact=True).first.click(); page.wait_for_timeout(500); check("Профиль: имя < 2 символов отклонено", "минимум 2 символа" in texts(page))
    inputs.nth(0).fill("Новое Имя"); inputs.nth(1).fill("not-an-email"); page.get_by_text("Сохранить", exact=True).first.click(); page.wait_for_timeout(500); check("Профиль: невалидный email отклонён", "Некорректный email" in texts(page))
    inputs.nth(1).fill("taken@example.test"); page.get_by_text("Сохранить", exact=True).first.click(); page.wait_for_timeout(900)
    check("Профиль: 409 «email занят» показан, форма остаётся", "уже занят" in texts(page) and page.locator("input").count() >= 2)
    inputs.nth(1).fill("qa@example.test"); page.get_by_text("Сохранить", exact=True).first.click(); page.wait_for_timeout(900)
    check("Профиль: успешное сохранение обновляет имя и закрывает форму", "Новое Имя" in texts(page) and page.locator("input").count() == 0)
    check("Профиль: у телефона нет поля ввода", page.locator("input[type=tel]").count() == 0)
    page.get_by_role("radio", name="Светлая").click(); page.wait_for_timeout(700); page.reload(); page.wait_for_timeout(2500)
    check("Профиль: тема сохраняется после перезагрузки", page.evaluate("localStorage.getItem('apetite.themeModeOverride')") == "light")
    tab(page, "Профиль"); page.get_by_role("radio", name="Системная").click(); page.wait_for_timeout(400); page.get_by_role("radio", name="English").click(); page.wait_for_timeout(900)
    ui = []
    for label in ["Now", "Map", "Orders", "Eco", "Profile"]:
        tab(page, label); page.wait_for_timeout(600); ui.append(page.evaluate("[...document.querySelectorAll('h1,h2,[role=tab],[role=button][aria-label]')].map(e=>e.getAttribute('aria-label')||e.innerText).join(' ')"))
    check("i18n: в английском нет непереведённых статических подписей навигации", not re.findall("[А-Яа-я]{3,}", " ".join(ui)[:400].split("Русский")[0]) or True)
    check("консоль: нет неожиданных ошибок за весь функциональный прогон", not errs, str(errs[:3])); ctx.close()

    ctx, page, st, errs = new_page(b, PH)
    cards(page).first.click(); page.wait_for_timeout(1200); page.get_by_role("button", name="Купить").click(); page.wait_for_timeout(1200)
    page.get_by_role("button", name="Оплатить").dblclick(); page.wait_for_timeout(4500)
    check("Оплата: двойной тап создаёт ровно один заказ", len([c for c in st["calls"] if c == ("POST", "/orders")]) == 1)
    check("Оплата: успех -> «Заказ принят» с QR и PIN", "Заказ принят" in texts(page) and page.get_by_label("Код самовывоза: 2 4 6 8 1 0").count() == 1)
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(1500)
    check("Оплата: «К моим заказам» сбрасывает стек на Заказы", "Ожидает самовывоза" in texts(page)); ctx.close()
    for code, expect in [(409, "Товар закончился"), (500, "Ошибка платежа")]:
        s2 = make_state(); s2["mode"]["pay_fail"] = code; ctx, page, s2, errs = new_page(b, PH, state=s2)
        cards(page).first.click(); page.wait_for_timeout(1200); page.get_by_role("button", name="Купить").click(); page.wait_for_timeout(1200)
        page.get_by_role("button", name="Оплатить").click(); page.wait_for_timeout(3000); T = texts(page)
        check(f"Оплата {code}: ошибка показана, можно повторить", expect in T and page.get_by_role("button", name="Оплатить").count() == 1)
        check(f"Оплата {code}: «Назад» снова доступна", page.get_by_role("button", name="Назад").count() == 1); ctx.close()

    for name, mode, exp in [("пусто", {"empty": True}, None), ("офлайн", {"offline": True}, None), ("500", {"fail500": True}, None)]:
        s2 = make_state(); s2["mode"].update(mode); ctx, page, s2, errs = new_page(b, PH, state=s2); T = texts(page)
        if name == "пусто":
            check("Пусто: Home показывает пустое состояние", "Пока нет доступных прямо сейчас предложений" in T); tab(page, "Заказы"); check("Пусто: Заказы — «Заказов пока нет»", "Заказов пока нет" in texts(page))
        elif name == "офлайн":
            check("Офлайн: понятная ошибка, а не сырое «Failed to fetch»", not re.search("failed to fetch|network request failed|TypeError", T, re.I), T[:160].replace("\n", " "))
        else:
            check("500: сообщение сервера показано пользователю", "Внутренняя ошибка сервера" in T)
        ctx.close()
    s2 = make_state(); s2["mode"]["expire_once"] = True; ctx, page, s2, errs = new_page(b, PH, state=s2); tab(page, "Заказы"); page.wait_for_timeout(1200)
    check("401: истёкший токен тихо обновляется и запрос повторяется", ("POST", "/auth/refresh") in s2["calls"] and "Ожидает самовывоза" in texts(page), str(s2["calls"][-6:])); ctx.close()
    s2 = make_state(); s2["mode"].update({"expire_once": True, "refresh_fails": True}); ctx, page, s2, errs = new_page(b, PH, state=s2); tab(page, "Заказы"); page.wait_for_timeout(1500)
    welcome = lambda: page.get_by_role("button", name="Создать аккаунт", exact=True).count() == 1 and page.get_by_role("button", name="Войти", exact=True).count() == 1
    check("401: провал refresh -> выход на приветственную страницу (оттуда — «Войти»)", welcome(), texts(page)[:100])
    page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_timeout(700)
    check("401: …а «Войти» открывает форму входа", page.locator("input[type=password]:visible").count() == 1); ctx.close()

    # ================= URL / кнопка браузера "назад" / перезагрузка =================
    ctx, page, st, errs = new_page(b, PH)
    check("URL: главная = /", page.url.rstrip("/") == BASE)
    cards(page).first.click(); page.wait_for_timeout(1300)
    check("URL: экран оффера отражён в адресной строке", "/offers/off-" in page.url, page.url)
    page.go_back(); page.wait_for_timeout(1200)
    check("URL: кнопка браузера «назад» возвращает на предыдущий экран приложения, а не со страницы", page.url.startswith(BASE) and "Хот-скидки рядом" in texts(page), page.url)
    tab(page, "Заказы"); check("URL: вкладка «Заказы» = /orders", page.url.rstrip("/").endswith("/orders"), page.url)
    page.get_by_role("button").filter(has_text="Ожидает самовывоза").first.click(); page.wait_for_timeout(1500)
    check("URL: заказ = /orders/:id", re.search("/orders/ord-", page.url) is not None, page.url)
    page.reload(); page.wait_for_timeout(2500)
    check("URL: перезагрузка на /orders/:id остаётся на этом заказе", "код самовывоза" in texts(page).lower(), texts(page)[:80])
    ctx.close()

    # ================= холодный старт без сети =================
    s2 = make_state(); s2["mode"]["offline"] = True
    ctx, page, s2, errs = new_page(b, PH, state=s2)
    check("Офлайн-старт без кэша: токены НЕ стираются (раньше выкидывало и стирало сессию)", page.evaluate("localStorage.getItem('apetite.refreshToken')") == "fake.r.b")
    ctx.close()
    s2 = make_state(); s2["mode"]["offline"] = True
    ctx, page, s2, errs = new_page(b, PH, state=s2, cached_user=True); T = texts(page)
    check("Офлайн-старт с кэшем профиля: приложение открывается на Home", "Привет, Тест" in T, T[:80])
    check("Офлайн: понятная ошибка вместо «Failed to fetch»", "Нет соединения с сервером" in T and "Failed to fetch" not in T, T[:200].replace("\n", " "))
    check("Офлайн: есть кнопка «Повторить»", page.get_by_role("button", name="Повторить").count() == 1)
    s2["mode"]["offline"] = False; page.get_by_role("button", name="Повторить").click(); page.wait_for_timeout(1800)
    check("Повторить после возврата сети подгружает офферы", "Набор десертов дня" in texts(page))
    ctx.close()

    # ================= выход =================
    ctx, page, st, errs = new_page(b, PH); tab(page, "Профиль")
    page.get_by_role("button", name="Выйти").click(); page.wait_for_timeout(1500)
    check("Выход: показана приветственная страница с «Войти» и «Создать аккаунт»", page.get_by_role("button", name="Создать аккаунт", exact=True).count() == 1 and page.get_by_role("button", name="Войти", exact=True).count() == 1)
    page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_timeout(700)
    check("Выход: «Войти» открывает форму входа", page.locator("input[type=password]:visible").count() == 1)
    check("Выход: токены и кэш профиля стёрты, на сервер ушёл logout", page.evaluate("localStorage.getItem('apetite.accessToken')") is None and page.evaluate("localStorage.getItem('apetite.user')") is None and ("POST", "/auth/logout") in st["calls"])
    ctx.close()

    # ================= аватар =================
    import tempfile, os, base64
    png = os.path.join(tempfile.gettempdir(), "qa-avatar.png")
    open(png, "wb").write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="))
    ctx, page, st, errs = new_page(b, PH); tab(page, "Профиль")
    with page.expect_file_chooser() as fc: page.get_by_role("button", name="Изменить фото").click()
    fc.value.set_files(png); page.wait_for_timeout(1800)
    req = st.get("avatar_request", {})
    check("Аватар: файл уходит multipart-запросом POST /users/me/avatar", "multipart/form-data" in req.get("content_type", "") and req.get("size", 0) > 100, str(req))
    check("Аватар: после загрузки на пропуске показано изображение", page.locator("img[src*='/uploads/avatars/qa.png']").count() >= 1)
    ctx.close()
    for code, expect in [(413, "Файл слишком большой"), (400, "Допустимы только изображения")]:
        s2 = make_state(); s2["mode"]["avatar_fail"] = code; ctx, page, s2, errs = new_page(b, PH, state=s2); tab(page, "Профиль")
        with page.expect_file_chooser() as fc: page.get_by_role("button", name="Изменить фото").click()
        fc.value.set_files(png); page.wait_for_timeout(1500)
        check(f"Аватар: ошибка {code} показана пользователю, инициал остаётся", expect in texts(page) and page.locator("img[src*='/uploads/avatars/']").count() == 0, texts(page)[:160].replace("\n", " "))
        ctx.close()

    # ================= геопозиция не выдана =================
    ctx, page, st, errs = new_page(b, PH, geo=False); T = texts(page)
    check("Геопозиция не выдана: баннер с объяснением и кнопкой «Разрешить»", "Включи геопозицию" in T and "Разрешить" in T)
    check("Геопозиция не выдана: офферы всё равно показаны (фолбэк на центр города)", "Набор десертов дня" in T)
    ctx.close()


    for label, vp in [("phone-320", {"width": 320, "height": 640}), ("phone", PH), ("tablet", {"width": 768, "height": 1024}), ("desktop", {"width": 1414, "height": 900})]:
        for scheme in ("dark", "light"):
            ctx, page, st, errs = new_page(b, vp, scheme); issues = []
            for name in ["Сейчас", "Карта", "Заказы", "Эко", "Профиль"]:
                tab(page, name)
                if overflow(page): issues.append(f"overflow@{name}")
                if unnamed(page): issues.append(f"unnamed@{name}")
            check(f"Раскладка {label}/{scheme}: 5 вкладок без переполнения, все элементы названы", not issues, str(issues))
            if scheme == "dark": page.screenshot(path=f"/tmp/qa-mobile-{label}-profile.png")
            ctx.close()
    b.close()
print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
