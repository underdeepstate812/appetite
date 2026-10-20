"""Ручная правка и удаление выложенных офферов: API + кабинет заведения на РЕАЛЬНОМ backend (seed-аккаунты, только localhost).
API: правка количества (прибавка/убавка, не меньше проданного, раскуплен ↔ в продаже), удаление с витрины, отказ при заказах
(в работе / только история), чужой оффер, удаление авто-оффера вносит дату в пропуски шаблона (не выложится заново).
Кабинет: «Изменить» у выложенного — поле «Всего порций» с подсказкой, «Удалить» у любого статуса, понятные сообщения об отказе.
Создаёт и сам убирает свои тестовые данные («QA ручной …»). Нужны backend :3000 и admin :5173.
Запуск: python3 qa/qa_admin_offer_manage.py"""
import json, os, re, sys, urllib.request
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

API = os.environ.get("API_URL", "http://localhost:3000/api/v1"); ADMIN = os.environ.get("ADMIN_URL", "http://localhost:5173")
for url in (API, ADMIN):
    if urlparse(url).hostname not in ("localhost", "127.0.0.1", "::1"):
        sys.exit(f"Отказ: {url} — не локальный dev-хост; сценарий с тестовым входом идёт только на localhost.")
PASSWORD = os.environ.get("QA_PASSWORD", "password123")  # демо-аккаунты из prisma/seed.ts
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
MSK = timezone(timedelta(hours=3)); now = datetime.now(MSK)
iso = lambda dt: dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

owner = login("cafe.pushkin@apetite.ru"); other = login("bulka.arbat@apetite.ru"); admin = login("admin@apetite.ru"); user = login("user@apetite.ru")
st, me = api("GET", "/businesses/my", token=owner["accessToken"])
if st != 200:
    st, lst = api("GET", "/businesses", token=owner["accessToken"]); me = next(b for b in (lst["items"] if isinstance(lst, dict) else lst) if b.get("ownerUserId") == owner["user"]["id"])
BID = me["id"]; OT = owner["accessToken"]
TAG = "QA ручной " + os.urandom(2).hex()
created_offers, created_schedules = [], []
ui_order = None
def new_offer(suffix, **over):
    body = dict(businessId=BID, title=f"{TAG} {suffix}", category="BAKERY", originalPriceRub=300, baseDiscountPercent=40, weightKg=0.3, quantityTotal=10,
                pickupStart=iso(now - timedelta(minutes=30)), pickupEnd=iso(now + timedelta(hours=4)), ingredients="Мука, масло", allergens=["gluten"],
                bestBefore=iso(now + timedelta(hours=12)), discountMode="FIXED"); body.update(over)
    st, o = api("POST", "/offers", body, OT); assert st in (200, 201), (st, o); created_offers.append(o["id"]); return o
def get_offer(oid):
    st, d = api("GET", f"/offers/{oid}", token=OT); return d if st == 200 else None
def listed(oid):
    st, d = api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT); return any(o["id"] == oid for o in d["items"])

try:
    # ---------- API: офферы живут не дольше суток (заведения закрываются, витрина обновляется каждые сутки) ----------
    def try_create(suffix, start_h, end_h):
        body = dict(businessId=BID, title=f"{TAG} {suffix}", category="BAKERY", originalPriceRub=300, baseDiscountPercent=50, weightKg=0.3, quantityTotal=3, ingredients="Мука", allergens=[],
                    bestBefore=iso(now + timedelta(hours=end_h + 6)), pickupStart=iso(now + timedelta(hours=start_h)), pickupEnd=iso(now + timedelta(hours=end_h)))
        st, o = api("POST", "/offers", body, OT)
        if st in (200, 201): created_offers.append(o["id"])
        return st, o
    st, d = try_create("сутки", -1, 23); check("окно 24 часа («оффер дня» на 22 ч до конца) — 400, причина названа", st == 400 and "не длиннее 12 часов" in json.dumps(d, ensure_ascii=False), (st, d))
    st, d = try_create("13ч", 0, 13); check("окно 13 часов — 400", st == 400, st)
    st, d = try_create("далеко", 26, 30); check("короткое окно, но конец позже чем через сутки — 400", st == 400 and "дольше 24 часов" in json.dumps(d, ensure_ascii=False), (st, d))
    st, d = try_create("12ч", -1, 11); check("окно 12 часов, конец через 11 часов — можно", st in (200, 201), (st, d))
    st, d = try_create("через-сутки", 20, 23.5); check("конец ровно в пределах суток — можно", st in (200, 201), (st, d))
    st, ch = api("PATCH", f"/offers/{created_offers[-1]}", {"pickupEnd": iso(now + timedelta(hours=40)), "pickupStart": iso(now + timedelta(hours=30))}, OT); check("перенос конца дальше суток — 400", st == 400, (st, ch))
    sched_bad = dict(businessId=BID, title=f"{TAG} шаблон-длинный", category="BAKERY", originalPriceRub=300, baseDiscountPercent=40, weightKg=0.3, quantityTotal=4, ingredients="Мука", allergens=[], bestBeforeHoursAfterEnd=6,
                     daysOfWeek=[1, 2, 3, 4, 5, 6, 7], pickupStartTime="08:00", pickupEndTime="22:00", publishLeadMinutes=180, timezone="Europe/Moscow")
    st, d = api("POST", "/offer-schedules", sched_bad, OT); check("шаблон с окном 14 часов — 400", st == 400, (st, d))
    st, d = api("POST", "/offer-schedules", {**sched_bad, "pickupEndTime": "11:00", "publishLeadMinutes": 24 * 60}, OT); check("шаблон: 3 ч окно + выкладка за 24 ч — 400 (живёт дольше суток)", st == 400 and "24 часов" in json.dumps(d, ensure_ascii=False), (st, d))

    # ---------- API: количество ----------
    o = new_offer("кол-во")
    st, r = api("POST", "/orders", {"offerId": o["id"], "quantity": 4}, user["accessToken"]); check("тестовая покупка 4 из 10 оформлена", st in (200, 201), (st, r)); order_id = r["id"] if isinstance(r, dict) and "id" in r else (r.get("order", {}) or {}).get("id")
    st, ch = api("PATCH", f"/offers/{o['id']}", {"quantityTotal": 15}, OT); cur = get_offer(o["id"])
    check("добавили порции: всего 15, свободно 11 (проданные 4 на месте)", st == 200 and cur["quantityTotal"] == 15 and cur["quantityLeft"] == 11, (st, cur and (cur["quantityTotal"], cur["quantityLeft"])))
    st, ch = api("PATCH", f"/offers/{o['id']}", {"quantityTotal": 7}, OT); cur = get_offer(o["id"])
    check("убрали свободные: всего 7, свободно 3", st == 200 and cur["quantityTotal"] == 7 and cur["quantityLeft"] == 3, (st, cur and (cur["quantityTotal"], cur["quantityLeft"])))
    st, ch = api("PATCH", f"/offers/{o['id']}", {"quantityTotal": 3}, OT); cur = get_offer(o["id"])
    check("меньше проданного (3 < 4) — 400 с понятной причиной, ничего не изменилось", st == 400 and "продано 4" in json.dumps(ch, ensure_ascii=False) and cur["quantityTotal"] == 7, (st, ch))
    st, ch = api("PATCH", f"/offers/{o['id']}", {"quantityTotal": 0}, OT); check("ноль порций — 400", st == 400, st)
    st, ch = api("PATCH", f"/offers/{o['id']}", {"quantityTotal": 7}, OT); check("то же значение — без ошибок", st == 200, st)
    st, ch = api("PATCH", f"/offers/{o['id']}", {"quantityTotal": 12}, other["accessToken"]); check("владелец другого заведения не правит количество (403)", st == 403, st)
    st, ch = api("PATCH", f"/offers/{o['id']}", {"quantityTotal": 4}, OT); cur = get_offer(o["id"])
    check("убрали все свободные → «раскуплен»", st == 200 and cur["status"] == "SOLD_OUT" and cur["quantityLeft"] == 0, cur and (cur["status"], cur["quantityLeft"]))
    st, ch = api("PATCH", f"/offers/{o['id']}", {"quantityTotal": 6}, OT); cur = get_offer(o["id"])
    check("добавили порции раскупленному → снова «в продаже»", st == 200 and cur["status"] == "ACTIVE" and cur["quantityLeft"] == 2, cur and (cur["status"], cur["quantityLeft"]))

    # ---------- API: удаление ----------
    st, d = api("DELETE", f"/offers/{o['id']}", token=OT)
    check("оффер с заказом в работе не удаляется: 409 «заказы в работе»", st == 409 and "в работе" in json.dumps(d, ensure_ascii=False), (st, d)); check("…и остаётся на витрине", get_offer(o["id"]) is not None)
    st, d = api("PATCH", f"/orders/{order_id}/cancel", token=admin["accessToken"]); check("заказ отменён (отмена — только у админа платформы) (в БД остаётся история CANCELLED)", st == 200, (st, d))
    st, d = api("DELETE", f"/offers/{o['id']}", token=OT)
    check("после выдачи/отмены остаётся история: 409 «уберите в архив», оффер на месте", st == 409 and "архив" in json.dumps(d, ensure_ascii=False) and get_offer(o["id"]) is not None, (st, d))
    st, ch = api("PATCH", f"/offers/{o['id']}", {"status": "ARCHIVED"}, OT); check("архив при этом работает", st == 200 and get_offer(o["id"])["status"] == "ARCHIVED", st)

    clean = new_offer("чистый")
    st, d = api("DELETE", f"/offers/{clean['id']}", token=other["accessToken"]); check("владелец другого заведения не удаляет (403), оффер на месте", st == 403 and get_offer(clean["id"]) is not None, st)
    st, d = api("DELETE", f"/offers/{clean['id']}", token=OT)
    check("активный оффер без заказов удаляется прямо с витрины", st == 200 and d["success"] is True and d["skippedDate"] is None and get_offer(clean["id"]) is None and not listed(clean["id"]), (st, d)); created_offers.remove(clean["id"])
    st, d = api("DELETE", f"/offers/{clean['id']}", token=OT); check("повторное удаление — 404", st == 404, st)

    # ---------- API: авто-оффер → пропуск даты ----------
    start = now + timedelta(hours=2); end = start + timedelta(minutes=90)
    sched = dict(businessId=BID, title=f"{TAG} шаблон", category="BAKERY", originalPriceRub=300, baseDiscountPercent=40, weightKg=0.3, quantityTotal=4, ingredients="Мука", allergens=[], bestBeforeHoursAfterEnd=6,
                 daysOfWeek=[1, 2, 3, 4, 5, 6, 7], pickupStartTime=start.strftime("%H:%M"), pickupEndTime=end.strftime("%H:%M"), publishLeadMinutes=180, timezone="Europe/Moscow", discountMode="FIXED")
    st, s = api("POST", "/offer-schedules", sched, OT); assert st in (200, 201), (st, s); created_schedules.append(s["id"])
    api("POST", "/scheduler/run-schedules", token=admin["accessToken"])
    st, d = api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT); auto = [x for x in d["items"] if x["title"] == f"{TAG} шаблон"]; created_offers += [x["id"] for x in auto]
    check("шаблон выложил оффер на сегодня", len(auto) == 1 and auto[0]["scheduleId"] == s["id"], auto)
    if auto:
        day = auto[0]["occurrenceDate"]
        st, d = api("DELETE", f"/offers/{auto[0]['id']}", token=OT); created_offers.remove(auto[0]["id"])
        check("удалили авто-оффер: ответ называет пропущенную дату", st == 200 and d["skippedDate"] == day, (st, d))
        st, lst = api("GET", f"/offer-schedules?businessId={BID}", token=OT); cur = next(x for x in lst if x["id"] == s["id"])
        check("дата внесена в пропуски шаблона", day in cur["skipDates"], cur["skipDates"])
        api("POST", "/scheduler/run-schedules", token=admin["accessToken"])
        st, d = api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT)
        check("повторный запуск автовыкладки НЕ создаёт удалённый оффер заново", not [x for x in d["items"] if x["title"] == f"{TAG} шаблон" and x["occurrenceDate"] == day], [x["occurrenceDate"] for x in d["items"] if x["title"] == f"{TAG} шаблон"])

    # ---------- кабинет ----------
    ui = new_offer("кабинет", quantityTotal=8)
    st, r = api("POST", "/orders", {"offerId": ui["id"], "quantity": 3}, user["accessToken"]); ui_order = r.get("id") if isinstance(r, dict) else None
    ui_del = new_offer("на удаление")
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={"width": 1360, "height": 1000}, timezone_id="Europe/Moscow", locale="ru-RU"); page = ctx.new_page(); errs = []; dialogs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        def on_dialog(d): dialogs.append(d.message); d.accept()
        page.on("dialog", on_dialog)
        page.goto(ADMIN + "/login"); page.evaluate("([a, r]) => { localStorage.setItem('apetite.admin.accessToken', a); localStorage.setItem('apetite.admin.refreshToken', r); }", [owner["accessToken"], owner["refreshToken"]])
        page.goto(ADMIN + "/offers"); page.wait_for_selector(f"tr:has-text('{TAG} кабинет')", timeout=20000)
        row = lambda t: page.locator("tr", has_text=f"{TAG} {t}")
        check("у выложенного оффера есть и «Изменить», и «В архив», и «Удалить»", all(row("кабинет").get_by_role("button", name=n).count() == 1 for n in ("Изменить", "В архив", "Удалить")))
        row("кабинет").get_by_role("button", name="Изменить").click(); page.wait_for_selector("text=Редактировать оффер")
        qty = page.locator("#quantity")
        check("в форме правки есть «Всего порций» = 8, минимум = проданным (3)", qty.input_value() == "8" and qty.get_attribute("min") == "3" and page.get_by_text("Уже продано 3, свободно 5").count() == 1, (qty.input_value(), qty.get_attribute("min")))
        qty.fill("12"); page.get_by_role("button", name="Сохранить").click(); page.wait_for_timeout(1500)
        cur = get_offer(ui["id"]); check("правка из кабинета: всего 12, свободно 9", cur["quantityTotal"] == 12 and cur["quantityLeft"] == 9, cur and (cur["quantityTotal"], cur["quantityLeft"]))
        check("в таблице остаток обновился: 9 / 12", row("кабинет").get_by_text("9 / 12").count() == 1)
        # правка без изменения количества не трогает его
        row("кабинет").get_by_role("button", name="Изменить").click(); page.wait_for_selector("text=Редактировать оффер"); page.locator("#title").fill(f"{TAG} кабинет"); page.get_by_role("button", name="Сохранить").click(); page.wait_for_timeout(1200)
        cur = get_offer(ui["id"]); check("правка другого поля не меняет остаток", cur["quantityLeft"] == 9)
        # удаление чистого
        dialogs.clear(); row("на удаление").get_by_role("button", name="Удалить").click(); page.wait_for_timeout(1500)
        check("подтверждение удаления предупреждает, что оффер на витрине", dialogs and "на витрине" in dialogs[0], dialogs)
        check("удалённый исчез из таблицы, показано «удалён»", row("на удаление").count() == 0 and page.get_by_test_id("offers-action-note").inner_text().find("удалён") >= 0); created_offers.remove(ui_del["id"])
        # удаление с заказом — отказ
        dialogs.clear(); row("кабинет").get_by_role("button", name="Удалить").click(); page.wait_for_timeout(1500)
        note = page.get_by_test_id("offers-action-note")
        check("предупреждение: по офферу уже есть заказы", dialogs and "уже есть заказы (3 шт.)" in dialogs[0], dialogs)
        check("отказ показан красным сообщением с причиной, оффер остался в таблице", note.count() == 1 and note.get_attribute("role") == "alert" and "в работе" in note.inner_text() and row("кабинет").count() == 1, note.inner_text() if note.count() else None)
        page.screenshot(path=os.path.join(os.environ.get("QA_OUT", "/tmp"), "admin_offer_manage.png"))
        # архив → «Удалить» остаётся у архивного
        row("кабинет").get_by_role("button", name="В архив").click(); page.wait_for_timeout(1500)
        check("после архива кнопка «В архив» пропадает, «Удалить» остаётся", row("кабинет").get_by_role("button", name="В архив").count() == 0 and row("кабинет").get_by_role("button", name="Удалить").count() == 1)
        check("нет JS-ошибок в кабинете", not errs, errs[:2])
        b.close()
finally:
    if ui_order: api("PATCH", f"/orders/{ui_order}/cancel", token=admin["accessToken"])  # чтобы тестовый заказ «в работе» не висел у владельца
    for sid in created_schedules: api("DELETE", f"/offer-schedules/{sid}", token=OT)
    st, d = api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT)
    for x in (d["items"] if st == 200 else []):
        if x["title"].startswith(TAG):
            if api("DELETE", f"/offers/{x['id']}", token=OT)[0] == 409:  # с историей заказов удалить нельзя — остаётся в архиве
                api("PATCH", f"/offers/{x['id']}", {"status": "ARCHIVED"}, OT)

print(f"\n{'FAILED: ' + str(len(fails)) if fails else 'ALL PASSED'}"); sys.exit(1 if fails else 0)
