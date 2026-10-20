"""Состав/аллергены/срок годности и подтверждение выдачи покупателем — на РЕАЛЬНОМ backend (API), сид-аккаунты из prisma/seed.ts.
Создаёт тестовый оффер «QA состав-тест …» и два тестовых заказа; в конце оффер уходит в архив (заказы ссылаются на него, удалить нельзя).
Работает только с локальным API. Запуск: python3 qa/qa_food_receipt_api.py"""
import json, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

API = os.environ.get("API_URL", "http://localhost:3000/api/v1")
if urlparse(API).hostname not in ("localhost", "127.0.0.1", "::1"):
    sys.exit(f"Отказ: {API} — не локальный адрес; сценарий с тестовым входом запускается только на localhost.")
PASSWORD = os.environ.get("QA_PASSWORD", "password123")  # демо-аккаунты из prisma/seed.ts
BUSINESS, BUYER, ADMIN = os.environ.get("QA_BUSINESS", "cafe.pushkin@apetite.ru"), os.environ.get("QA_USER", "user@apetite.ru"), os.environ.get("QA_ADMIN", "admin@apetite.ru")
fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" | " + str(extra)[:300] if extra and not cond else ""))
    if not cond: fails.append(name)

def api(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + token} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            t = r.read().decode(); return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode();
        try: return e.code, json.loads(raw or "null")
        except ValueError: return e.code, raw

def login(email):
    st, d = api("POST", "/auth/login", {"identifier": email, "password": PASSWORD}); assert st in (200, 201), (email, st, d)
    return d["accessToken"], d["user"]

owner_tok, owner = login(BUSINESS); buyer_tok, buyer = login(BUYER); admin_tok, admin = login(ADMIN)
st, mine = api("GET", "/businesses/mine", token=owner_tok); biz = (mine[0] if isinstance(mine, list) else mine)
iso = lambda dt: dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
now = datetime.now(timezone.utc); p_start, p_end = now - timedelta(minutes=30), now + timedelta(hours=3)
def offer(**over):
    body = {"businessId": biz["id"], "title": "QA состав-тест " + str(int(time.time())), "category": "FOOD", "originalPriceRub": 400, "baseDiscountPercent": 50,
            "weightKg": 0.3, "quantityTotal": 5, "pickupStart": iso(p_start), "pickupEnd": iso(p_end), **over}
    return api("POST", "/offers", body, owner_tok)
FULL = {"ingredients": "Тесто (пшеничная мука, вода), сыр, томаты", "allergens": ["gluten", "milk"], "bestBefore": iso(p_end + timedelta(hours=4))}
msg = lambda d: json.dumps(d, ensure_ascii=False)
created = []

# ───────── Часть 1: состав, аллергены, срок годности ─────────
st, d = offer(); check("еда без состава/аллергенов/срока — 400", st == 400 and "остав" in msg(d), (st, d))
st, d = offer(ingredients="Мука, вода"); check("только состав — 400, просят аллергены", st == 400 and "ллерген" in msg(d), (st, d))
st, d = offer(ingredients="Мука, вода", allergens=[]); check("состав и «аллергенов нет», но без срока годности — 400", st == 400 and "срок годности" in msg(d), (st, d))
st, d = offer(**{**FULL, "bestBefore": iso(p_end - timedelta(hours=1))}); check("срок годности раньше конца самовывоза — 400", st == 400 and "раньше конца" in msg(d), (st, d))
st, d = offer(**{**FULL, "allergens": ["gluten", "dragonfruit"]}); check("неизвестный аллерген — 400", st == 400, (st, d))
st, d = offer(**{**FULL, "allergens": ["milk", "milk"]}); check("повтор аллергена — 400", st == 400, (st, d))
st, d = offer(**{**FULL, "ingredients": "ab"}); check("состав из 2 символов — 400", st == 400, (st, d))
st, d = offer(**{**FULL, "ingredients": "я" * 1001}); check("состав длиннее 1000 символов — 400", st == 400, (st, d))
st, d = offer(**FULL); check("полный набор — оффер создан", st in (200, 201) and d["ingredients"] == FULL["ingredients"] and d["allergens"] == ["gluten", "milk"] and d["allergensDeclared"] is True and d["bestBefore"], (st, d))
food_offer = d if st in (200, 201) else None
if food_offer: created.append(food_offer["id"])
st, d = offer(ingredients="Мука, вода", allergens=[], bestBefore=iso(p_end + timedelta(hours=2)), title="QA без аллергенов " + str(int(time.time())))
check("«аллергенов нет» (пустой список) — допустимо и фиксируется как заявленное", st in (200, 201) and d["allergens"] == [] and d["allergensDeclared"] is True, (st, d))
if st in (200, 201): created.append(d["id"])
st, d = offer(category="FLOWERS", title="QA цветы " + str(int(time.time()))); check("цветам состав не нужен — создаются без него", st in (200, 201) and d["allergensDeclared"] is False and d["ingredients"] is None, (st, d))
if st in (200, 201): created.append(d["id"])

if food_offer:
    oid = food_offer["id"]
    st, d = api("PATCH", f"/offers/{oid}", {"ingredients": "x"}, owner_tok); check("правка: слишком короткий состав — 400", st == 400, (st, d))
    st, d = api("PATCH", f"/offers/{oid}", {"bestBefore": iso(p_end - timedelta(hours=2))}, owner_tok); check("правка: срок годности раньше конца самовывоза — 400", st == 400, (st, d))
    st, d = api("PATCH", f"/offers/{oid}", {"pickupStart": iso(p_start + timedelta(hours=9)), "pickupEnd": iso(p_end + timedelta(hours=9))}, owner_tok); check("правка: перенос окна самовывоза за срок годности — 400", st == 400 and "раньше конца" in msg(d), (st, d))
    st, d = api("PATCH", f"/offers/{oid}", {"allergens": ["fish"], "ingredients": "Лосось, рис, нори"}, owner_tok); check("правка: аллергены и состав меняются", st == 200 and d["allergens"] == ["fish"] and d["ingredients"] == "Лосось, рис, нори", (st, d))
    st, d = api("PATCH", f"/offers/{oid}", {"originalPriceRub": 450}, owner_tok); check("правка цены не трогает и не требует состава", st == 200 and d["ingredients"] == "Лосось, рис, нори" and d["allergens"] == ["fish"], (st, d))
    st, d = api("PATCH", f"/offers/{oid}", {"allergens": ["gluten", "milk"], "ingredients": FULL["ingredients"]}, owner_tok)
    st, d = api("GET", f"/offers/{oid}"); check("GET /offers/:id отдаёт состав, аллергены и срок", st == 200 and d["ingredients"] and d["allergensDeclared"] and d["bestBefore"], (st, d))
    st, near = api("GET", f"/offers/nearby?lat={biz['lat']}&lng={biz['lng']}&radiusKm=5")
    row = next((o for o in near if o["id"] == oid), None) if isinstance(near, list) else None
    check("/offers/nearby тоже отдаёт состав и аллергены (нужны карте и ленте на сайте)", row and row["ingredients"] and row["allergens"] == ["gluten", "milk"] and row["bestBefore"], row)
    st, d = api("PATCH", f"/offers/{oid}", {"ingredients": "чужой"}, buyer_tok); check("покупатель не может править оффер — 403", st == 403, (st, d))

# ───────── Часть 2: подтверждение выдачи покупателем ─────────
def order_and_complete(complete=True):
    st, o = api("POST", "/orders", {"offerId": food_offer["id"], "quantity": 1}, buyer_tok); assert st in (200, 201), (st, o)
    if complete:
        st, c = api("PATCH", f"/orders/{o['id']}/complete", {"pickupCode": o["pickupCode"]}, admin_tok); assert st == 200, (st, c)
    return o
if food_offer:
    o1 = order_and_complete(complete=False)
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": True}, buyer_tok); check("до выдачи заведением ответить нельзя — 409", st == 409, (st, d))
    st, c = api("PATCH", f"/orders/{o1['id']}/complete", {"pickupCode": o1["pickupCode"]}, admin_tok); check("заведение/админ отмечает выдачу", st == 200 and c["status"] == "COMPLETED", (st, c))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": True}, owner_tok); check("владелец заведения отвечать за покупателя не может — 403", st == 403, (st, d))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": True}, admin_tok); check("админ отвечать за покупателя тоже не может — 403", st == 403, (st, d))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": True})
    check("без входа — 401", st == 401, (st, d))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": "yes"}, buyer_tok); check("received не boolean — 400", st == 400, (st, d))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": False}, buyer_tok); check("спор без причины — 400", st == 400, (st, d))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": False, "reason": "STOLEN"}, buyer_tok); check("спор с неизвестной причиной — 400", st == 400, (st, d))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": False, "reason": "OTHER", "note": "я" * 501}, buyer_tok); check("пояснение длиннее 500 символов — 400", st == 400, (st, d))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": True}, buyer_tok); check("«получил» — подтверждено, время записано", st in (200, 201) and d["receiptConfirmedAt"] and not d["receiptDisputedAt"], (st, d))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": True}, buyer_tok); check("повторный ответ — 409", st == 409, (st, d))
    st, d = api("POST", f"/orders/{o1['id']}/receipt", {"received": False, "reason": "NOT_RECEIVED"}, buyer_tok); check("после подтверждения спор открыть нельзя — 409", st == 409, (st, d))
    st, d = api("GET", f"/orders/{o1['id']}", token=buyer_tok); check("GET заказа отдаёт ответ покупателя", st == 200 and d["receiptConfirmedAt"], (st, d))

    st, stats0 = api("GET", "/platform/stats", token=admin_tok); st, bstats0 = api("GET", f"/businesses/{biz['id']}/stats", token=owner_tok)
    st, n0 = api("GET", "/notifications?unreadOnly=false", token=admin_tok)
    o2 = order_and_complete()
    st, d = api("POST", f"/orders/{o2['id']}/receipt", {"received": False, "reason": "WRONG_ITEM", "note": "  Дали другую пиццу  "}, buyer_tok)
    check("спор: причина и пояснение сохранены (пробелы обрезаны)", st in (200, 201) and d["receiptDisputedAt"] and d["receiptDisputeReason"] == "WRONG_ITEM" and d["receiptDisputeNote"] == "Дали другую пиццу" and not d["receiptConfirmedAt"], (st, d))
    st, d = api("POST", f"/orders/{o2['id']}/receipt", {"received": False, "reason": "OTHER"}, buyer_tok); check("повторный спор — 409", st == 409, (st, d))
    st, d = api("POST", f"/orders/{o2['id']}/receipt", {"received": True}, buyer_tok); check("после спора «получил» нажать нельзя — 409", st == 409, (st, d))
    st, stats1 = api("GET", "/platform/stats", token=admin_tok); st, bstats1 = api("GET", f"/businesses/{biz['id']}/stats", token=owner_tok)
    check("платформенная статистика считает оспоренные заказы", stats1["disputedOrders"] == stats0["disputedOrders"] + 1, (stats0.get("disputedOrders"), stats1.get("disputedOrders")))
    check("статистика заведения тоже", bstats1["disputedOrders"] == bstats0["disputedOrders"] + 1, (bstats0.get("disputedOrders"), bstats1.get("disputedOrders")))
    def disputed_notes(token):
        st, n = api("GET", "/notifications", token=token)
        items = n["items"] if isinstance(n, dict) else n
        return [x for x in items if x["type"] == "RECEIPT_DISPUTED" and (x.get("data") or {}).get("orderId") == o2["id"]]
    check("админу платформы пришло уведомление о споре с id заказа", len(disputed_notes(admin_tok)) == 1)
    check("владельцу заведения тоже", len(disputed_notes(owner_tok)) == 1)
    check("покупателю такое уведомление не приходит", len(disputed_notes(buyer_tok)) == 0)
    st, d = api("GET", "/orders", token=buyer_tok); mine_orders = {o["id"]: o for o in d}
    check("список заказов покупателя отдаёт ответы по обоим заказам", mine_orders[o1["id"]]["receiptConfirmedAt"] and mine_orders[o2["id"]]["receiptDisputedAt"])

if food_offer:
    # Настоящая гонка: «получил» и «спор» уходят одновременно по одному заказу — принят должен быть ровно один ответ.
    import threading
    for attempt in range(3):
        o3 = order_and_complete(); results = []
        def fire(body): results.append(api("POST", f"/orders/{o3['id']}/receipt", body, buyer_tok)[0])
        threads = [threading.Thread(target=fire, args=(b,)) for b in ({"received": True}, {"received": False, "reason": "QUALITY"}, {"received": True}, {"received": False, "reason": "OTHER"})]
        [t.start() for t in threads]; [t.join() for t in threads]
        st, final = api("GET", f"/orders/{o3['id']}", token=buyer_tok)
        ok = sorted(results).count(200) + sorted(results).count(201)
        check(f"гонка ответов #{attempt + 1}: из 4 одновременных принят ровно один, остальные 409", ok == 1 and results.count(409) == 3, results)
        check(f"гонка ответов #{attempt + 1}: у заказа итог — либо «получил», либо спор, не оба сразу", bool(final["receiptConfirmedAt"]) != bool(final["receiptDisputedAt"]), final)

for oid in created:  # заказы ссылаются на оффер — удалить нельзя, поэтому архивируем; офферы без заказов удаляем
    st, d = api("DELETE", f"/offers/{oid}", token=owner_tok)
    if st >= 400: api("PATCH", f"/offers/{oid}", {"status": "ARCHIVED"}, owner_tok)

print("\nFAILS:", fails); sys.exit(1 if fails else 0)
