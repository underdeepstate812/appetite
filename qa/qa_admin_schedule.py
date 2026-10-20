"""Автовыкладка и режим скидки: API + кабинет заведения на РЕАЛЬНОМ backend (seed-аккаунты, только localhost).
API: права, валидация, выкладка по шаблону (идемпотентность, пауза, пропуск даты, фиксированная/растущая скидка, удаление шаблона не
снимает офферы). Кабинет: выбор режима скидки, «Повторять автоматически» (дни, предпросмотр, ошибки), панель «Автовыкладка»
(ближайшие выкладки, пропуск, пауза, правка, удаление). Создаёт и сам убирает свои тестовые данные («QA авто …»).
Нужны backend :3000 и admin :5173. Запуск: python3 qa/qa_admin_schedule.py"""
import json, os, re, sys, urllib.request
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

API = os.environ.get("API_URL", "http://localhost:3000/api/v1"); ADMIN = os.environ.get("ADMIN_URL", "http://localhost:5173")
for url in (API, ADMIN):
    if urlparse(url).hostname not in ("localhost", "127.0.0.1", "::1"):
        sys.exit(f"Отказ: {url} — не локальный dev-хост; сценарий с тестовым входом идёт только на localhost.")
PASSWORD = os.environ.get("QA_PASSWORD", "password123")  # демо-аккаунты из prisma/seed.ts
OWNER = os.environ.get("QA_BUSINESS", "cafe.pushkin@apetite.ru")
fails = []
def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (" | " + str(detail)[:300] if detail and not cond else ""));
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
MSK = timezone(timedelta(hours=3))
now_msk = datetime.now(MSK)
hhmm = lambda dt: dt.strftime("%H:%M")
date_of = lambda dt: dt.strftime("%Y-%m-%d")

owner = login(OWNER); admin = login("admin@apetite.ru"); user = login("user@apetite.ru")
st, me = api("GET", "/businesses/my", token=owner["accessToken"])
if st != 200:
    st, lst = api("GET", "/businesses", token=owner["accessToken"]); me = next(b for b in (lst["items"] if isinstance(lst, dict) else lst) if b.get("ownerUserId") == owner["user"]["id"])
BID = me["id"]
TAG = "QA авто " + os.urandom(2).hex()
created_schedules, created_offers = [], []
base = dict(businessId=BID, category="BAKERY", originalPriceRub=300, baseDiscountPercent=40, weightKg=0.3, quantityTotal=4, ingredients="Мука, масло, молоко", allergens=["gluten", "milk"], bestBeforeHoursAfterEnd=6)
# окно «через 2 часа, 90 минут» с выкладкой за 3 часа: время публикации уже наступило — выкладка должна сработать сразу
start = now_msk + timedelta(hours=2); end = start + timedelta(minutes=90)
due = dict(daysOfWeek=[1, 2, 3, 4, 5, 6, 7], pickupStartTime=hhmm(start), pickupEndTime=hhmm(end), publishLeadMinutes=180, timezone="Europe/Moscow")
def offers_titled(title):
    st, d = api("GET", f"/offers?businessId={BID}&pageSize=100", token=owner["accessToken"]); return [o for o in d["items"] if o["title"] == title]
def run_materializer():
    st, d = api("POST", "/scheduler/run-schedules", token=admin["accessToken"]); return st, d

try:
    # ---------- права и валидация ----------
    st, _ = api("POST", "/offer-schedules", {**base, **due, "title": TAG}); check("без токена — 401", st == 401, st)
    st, _ = api("POST", "/offer-schedules", {**base, **due, "title": TAG}, token=user["accessToken"]); check("покупатель (роль USER) — 403", st == 403, st)
    st, _ = api("GET", f"/offer-schedules?businessId={BID}", token=user["accessToken"]); check("покупатель не читает шаблоны — 403", st == 403, st)
    bad = [({"daysOfWeek": []}, "хотя бы один день"), ({"daysOfWeek": [1, 1]}, "повторов"), ({"daysOfWeek": [0]}, "1"), ({"pickupStartTime": "7:00"}, ""),
           ({"pickupStartTime": "09:55", "pickupEndTime": "10:00"}, "не короче"), ({"timezone": "Mars/Olympus"}, "часовой пояс"), ({"publishLeadMinutes": 5000}, ""),
           ({"ingredients": None}, "состав"), ({"bestBeforeHoursAfterEnd": None}, "срок годности"), ({"baseDiscountPercent": 10}, ""), ({"originalPriceRub": -5}, ""), ({"startsOn": "2026-02-30"}, "")]
    for patch, text in bad:
        body = {**base, **due, "title": TAG, **patch}; body = {k: v for k, v in body.items() if v is not None}
        st, d = api("POST", "/offer-schedules", body, token=owner["accessToken"])
        check(f"плохой шаблон {list(patch)[0]}={list(patch.values())[0]} → 400" + (f" «{text}»" if text else ""), st == 400 and (text.lower() in json.dumps(d, ensure_ascii=False).lower()), (st, d))

    # ---------- фиксированная скидка: выкладка по шаблону ----------
    st, s1 = api("POST", "/offer-schedules", {**base, **due, "title": TAG + " фикс", "discountMode": "FIXED"}, token=owner["accessToken"])
    check("шаблон создан (фиксированная 40%)", st in (200, 201) and s1["discountMode"] == "FIXED" and s1["originalPrice"] == 30000 and s1["isActive"] is True, (st, s1)); created_schedules.append(s1["id"])
    st, r1 = run_materializer(); check("запуск выкладки (админ) создал оффер", st in (200, 201) and r1["created"] >= 1, (st, r1))
    found = offers_titled(TAG + " фикс")
    check("ровно один оффер на шаблон и дату", len(found) == 1, len(found))
    o = found[0] if found else {}
    created_offers.append(o.get("id"))
    check("оффер — копия шаблона: цена, количество, состав, режим, связь с шаблоном", o.get("originalPrice") == 30000 and o.get("quantityTotal") == 4 and o.get("quantityLeft") == 4 and o.get("ingredients") == "Мука, масло, молоко" and o.get("discountMode") == "FIXED" and o.get("scheduleId") == s1["id"] and re.match(r"\d{4}-\d{2}-\d{2}$", o.get("occurrenceDate", "")), o)
    check("фиксированная скидка = 40% (а не ступень «+10/+20»)", o.get("discountPercent") == 40 and o.get("discountedPrice") == 18000, o)
    check("срок годности = конец самовывоза + 6 ч", o and abs((datetime.fromisoformat(o["bestBefore"].replace("Z", "+00:00")) - datetime.fromisoformat(o["pickupEnd"].replace("Z", "+00:00"))).total_seconds() - 6 * 3600) < 1, o.get("bestBefore"))
    st, r2 = run_materializer(); check("повторный запуск не плодит дублей (идемпотентность)", len(offers_titled(TAG + " фикс")) == 1 and r2["created"] == 0, (st, r2))
    st, nearby = api("GET", "/offers/nearby?lat=59.9311&lng=30.3609&radiusKm=30")
    mine = [x for x in nearby if x["id"] == o.get("id")]
    check("оффер виден покупателям на витрине, режим скидки отдаётся", len(mine) == 1 and mine[0].get("discountMode") == "FIXED", mine[:1])

    # ---------- пропуск даты ----------
    day = o["occurrenceDate"]
    st, sk = api("POST", f"/offer-schedules/{s1['id']}/skip", {"date": day}, token=owner["accessToken"])
    check("пропуск даты: оффер на неё, которого ещё не заказывали, снят с витрины", st in (200, 201) and sk["archivedOfferId"] == o["id"] and day in sk["schedule"]["skipDates"], (st, sk))
    check("после пропуска оффер в архиве", offers_titled(TAG + " фикс")[0]["status"] == "ARCHIVED")
    run_materializer(); check("и заново не выкладывается", len(offers_titled(TAG + " фикс")) == 1)
    st, _ = api("POST", f"/offer-schedules/{s1['id']}/skip", {"date": "2020-01-01"}, token=owner["accessToken"]); check("пропуск прошедшей даты — 400", st == 400, st)
    st, _ = api("POST", f"/offer-schedules/{s1['id']}/skip", {"date": "2026-02-30"}, token=owner["accessToken"]); check("пропуск несуществующей даты — 400", st == 400, st)
    st, un = api("DELETE", f"/offer-schedules/{s1['id']}/skip/{day}", token=owner["accessToken"]); check("дату можно вернуть", st == 200 and day not in un["skipDates"], (st, un))

    # ---------- пауза, правка шаблона, растущая скидка ----------
    st, s2 = api("POST", "/offer-schedules", {**base, **due, "title": TAG + " растёт", "discountMode": "DYNAMIC", "isActive": False}, token=owner["accessToken"]); created_schedules.append(s2["id"])
    run_materializer(); check("шаблон на паузе ничего не выкладывает", len(offers_titled(TAG + " растёт")) == 0)
    st, up = api("PATCH", f"/offer-schedules/{s2['id']}", {"originalPriceRub": 350, "isActive": True}, token=owner["accessToken"]); check("правка шаблона: новая цена и снятие с паузы", st == 200 and up["originalPrice"] == 35000 and up["isActive"], (st, up))
    run_materializer(); g = offers_titled(TAG + " растёт"); created_offers += [x["id"] for x in g]
    check("после включения выложен оффер с новой ценой", len(g) == 1 and g[0]["originalPrice"] == 35000 and g[0]["discountMode"] == "DYNAMIC", g)
    check("растущая скидка: до конца окна > 3 ч — стартовые 40%", g and g[0]["discountPercent"] == 40, g[:1])
    st, _ = api("PATCH", f"/offer-schedules/{s2['id']}", {"pickupStartTime": "09:55", "pickupEndTime": "10:00"}, token=owner["accessToken"]); check("правка проверяет итоговое расписание (окно короче 15 минут) — 400", st == 400, st)
    # смена режима у уже выложенного оффера пересчитывает скидку сразу
    if g:
        st, ch = api("PATCH", f"/offers/{g[0]['id']}", {"discountMode": "FIXED", "baseDiscountPercent": 55}, token=owner["accessToken"]); check("оффер можно перевести в фиксированный режим — скидка 55% сразу", st == 200 and ch["discountPercent"] == 55 and ch["discountMode"] == "FIXED", (st, ch))
        st, ch = api("PATCH", f"/offers/{g[0]['id']}", {"discountMode": "DYNAMIC"}, token=owner["accessToken"]); check("и обратно в растущий", st == 200 and ch["discountMode"] == "DYNAMIC", (st, ch))

    # ---------- список, чужие данные, удаление ----------
    st, lst = api("GET", f"/offer-schedules?businessId={BID}", token=owner["accessToken"]); check("владелец видит свои шаблоны", st == 200 and {s1["id"], s2["id"]} <= {x["id"] for x in lst}, (st, len(lst) if isinstance(lst, list) else lst))
    st, _ = api("DELETE", f"/offer-schedules/{s1['id']}", token=owner["accessToken"]); created_schedules.remove(s1["id"])
    after = offers_titled(TAG + " фикс")
    check("удаление шаблона не снимает уже выложенные офферы (связь обнуляется)", st == 200 and len(after) == 1 and after[0]["scheduleId"] is None, (st, after[:1]))
    st, _ = api("PATCH", f"/offer-schedules/{s1['id']}", {"isActive": False}, token=owner["accessToken"]); check("удалённого шаблона больше нет — 404", st == 404, st)

    # ---------- кабинет ----------
    tomorrow = now_msk + timedelta(days=1)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={"width": 1360, "height": 1000}, timezone_id="Europe/Moscow", locale="ru-RU"); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        page.goto(ADMIN + "/login"); page.evaluate("([a, r]) => { localStorage.setItem('apetite.admin.accessToken', a); localStorage.setItem('apetite.admin.refreshToken', r); }", [owner["accessToken"], owner["refreshToken"]])
        page.goto(ADMIN + "/offers"); page.wait_for_selector("text=Автовыкладка", timeout=20000); page.wait_for_timeout(1200)
        check("панель «Автовыкладка»: шаблон на витрине с расписанием человеческим языком", page.get_by_text(TAG + " растёт").count() >= 1 and page.get_by_text("ежедневно").count() >= 1)
        check("в таблице офферов у автоматического — метка «авто», у фиксированного — «фиксированная»", page.locator("tr", has_text=TAG + " растёт").locator("text=авто").count() == 1 and page.locator("tr", has_text=TAG + " фикс").locator("text=фиксированная").count() == 1)
        row = page.locator("li", has_text=TAG + " растёт").first
        check("ближайшие выкладки показаны (до 3) с кнопками «пропустить»", row.get_by_role("button", name=re.compile("Пропустить выкладку")).count() >= 1, row.inner_text()[:200])
        page.screenshot(path=os.path.join(os.environ.get("QA_OUT", "/tmp"), "admin_schedules.png"))
        # пауза/включение из панели
        row.get_by_role("button", name=re.compile("Поставить на паузу")).click(); page.wait_for_timeout(1200)
        check("пауза из панели: статус «на паузе»", page.locator("li", has_text=TAG + " растёт").first.get_by_text("на паузе").count() == 1)
        page.locator("li", has_text=TAG + " растёт").first.get_by_role("button", name=re.compile("Включить")).click(); page.wait_for_timeout(1000)
        # пропуск ближайшей
        first_skip = page.locator("li", has_text=TAG + " растёт").first.get_by_role("button", name=re.compile("Пропустить выкладку")).first
        label = first_skip.get_attribute("aria-label"); first_skip.click(); page.wait_for_timeout(1200)
        check("пропуск из панели: дата зачёркнута, кнопка «вернуть»", page.locator("li", has_text=TAG + " растёт").first.get_by_role("button", name=re.compile("Вернуть выкладку")).count() == 1, label)
        # правка шаблона
        page.locator("li", has_text=TAG + " растёт").first.get_by_role("button", name="Изменить").click(); page.wait_for_selector("text=Шаблон автовыкладки")
        check("форма шаблона: режим скидки, дни, время, состав", page.get_by_role("radio", name=re.compile("Растёт к концу")).is_checked() and page.locator("#sch-start").input_value() == due["pickupStartTime"] and page.locator("#sch-qty").input_value() == "4" and page.locator("#sch-ingredients").input_value() != "")
        page.locator("#sch-qty").fill("7"); page.get_by_role("radio", name=re.compile("Фиксированная")).check(); page.get_by_role("button", name="Сохранить шаблон").click(); page.wait_for_timeout(1500)
        st, lst = api("GET", f"/offer-schedules?businessId={BID}", token=owner["accessToken"]); cur = next(x for x in lst if x["id"] == s2["id"])
        check("правка из кабинета сохранилась: 7 шт и фиксированная скидка", cur["quantityTotal"] == 7 and cur["discountMode"] == "FIXED", cur)
        # новый оффер с автоповтором
        page.get_by_role("button", name="+ Новый оффер").click(); page.wait_for_selector("text=Новый оффер")
        radios = page.get_by_role("radiogroup", name="Как меняется скидка").get_by_role("radio")
        check("в форме оффера есть выбор режима скидки, по умолчанию «Растёт к концу самовывоза»", radios.count() == 2 and page.get_by_role("radio", name=re.compile("Растёт к концу самовывоза")).is_checked())
        check("подсказка со ступенями: −50% → −60% → −70%", re.search(r"−50%.*−60%.*−70%", page.locator("fieldset", has_text="Скидка со временем").inner_text(), re.S) is not None)
        page.get_by_role("radio", name=re.compile("Фиксированная")).check()
        check("при «Фиксированной» подпись поля — «Скидка, %» и подсказка «Всё время самовывоза»", page.get_by_label("Скидка, %").count() == 1 and "Всё время самовывоза" in page.locator("fieldset", has_text="Скидка со временем").inner_text())
        check("блок «Повторять автоматически» скрыт, пока не включён", page.locator("#offer-repeat").count() == 1 and not page.locator("#offer-repeat").is_checked() and page.get_by_text("Дни недели").count() == 0)
        title = TAG + " форма"
        page.fill("#title", title); page.fill("#price", "400"); page.fill("#weight", "0.3"); page.fill("#quantity", "3")
        page.fill("#pickupStart", tomorrow.strftime("%Y-%m-%dT07:00")); page.fill("#pickupEnd", tomorrow.strftime("%Y-%m-%dT10:00"))
        page.fill("#offer-ingredients", "Тесто, сыр"); page.locator("#offer-allergens").click(); page.get_by_role("checkbox", name="Аллергенов нет", exact=True).check(); page.keyboard.press("Escape")
        page.locator("#offer-repeat").check()
        check("после включения — дни недели, «показывать на витрине», предпросмотр", page.get_by_text("Дни недели").count() == 1 and page.locator("#offer-lead").count() == 1 and page.get_by_text("Дальше:").count() >= 1)
        page.get_by_role("button", name="Будни").click(); page.get_by_role("button", name="Выходные").click()
        check("быстрые наборы дней: «Выходные» → пн–пт сняты, сб/вс нажаты", page.get_by_role("button", name="сб", exact=True).get_attribute("aria-pressed") == "true" and page.get_by_role("button", name="пн", exact=True).get_attribute("aria-pressed") == "false")
        for d in ("сб", "вс"): page.get_by_role("button", name=d, exact=True).click()
        page.get_by_role("button", name="Выложить и повторять").click(); page.wait_for_timeout(700)
        check("ни одного дня — понятная ошибка, оффер не создан", page.get_by_text("Выберите хотя бы один день недели").count() >= 1 and len(offers_titled(title)) == 0)
        wd = tomorrow.isoweekday()
        page.get_by_role("button", name=["пн", "вт", "ср", "чт", "пт", "сб", "вс"][wd - 1], exact=True).click()
        page.get_by_role("button", name="Выложить и повторять").click(); page.wait_for_timeout(2200)
        mine = offers_titled(title); created_offers += [x["id"] for x in mine]
        st, lst = api("GET", f"/offer-schedules?businessId={BID}", token=owner["accessToken"]); sch = [x for x in lst if x["title"] == title]; created_schedules += [x["id"] for x in sch]
        check("форма создала оффер и шаблон (фиксированная скидка, нужный день недели)", len(mine) == 1 and len(sch) == 1 and sch[0]["discountMode"] == "FIXED" and sch[0]["daysOfWeek"] == [wd] and sch[0]["pickupStartTime"] == "07:00" and sch[0]["pickupEndTime"] == "10:00", (mine, sch))
        check("первый оффер связан с шаблоном (дубля в тот день не будет)", mine and sch and mine[0]["scheduleId"] == sch[0]["id"] and mine[0]["occurrenceDate"] == date_of(tomorrow), mine[:1])
        check("нет JS-ошибок в кабинете", not errs, errs[:2])
        b.close()
finally:
    for sid in created_schedules: api("DELETE", f"/offer-schedules/{sid}", token=owner["accessToken"])
    st, d = api("GET", f"/offers?businessId={BID}&pageSize=100", token=owner["accessToken"])
    for o in (d["items"] if st == 200 else []):
        if o["title"].startswith(TAG): api("DELETE", f"/offers/{o['id']}", token=owner["accessToken"])

print(f"\n{'FAILED: ' + str(len(fails)) if fails else 'ALL PASSED'}"); sys.exit(1 if fails else 0)
