"""Часы работы заведения: оффер обязан закончиться до закрытия. API + кабинет на РЕАЛЬНОМ backend (seed-аккаунты, только localhost).
Часы подбираются ОТ ТЕКУЩЕГО МОМЕНТА (открылись 2 ч назад, закроемся через 5 ч, только в «сегодняшний» день недели), поэтому сценарий не зависит от времени суток.
Заведение — «Булочная на Рубинштейна» (bulka.arbat@apetite.ru); её исходные часы возвращаются в конце.
API: права на PUT, формат часов, офферы внутри/до открытия/после закрытия/в выходной, правка (окно не менялось — не блокируем), шаблоны (день/время/пояс),
конфликты при сужении часов (ничего не меняется, но список возвращается), автовыкладка пропускает то, что перестало влезать, null снимает ограничение.
Кабинет: карточка «Укажите часы работы» → редактор → подпись; подсказка и ошибка в форме оффера; быстрое создание режет конец по закрытию / отказывает, когда закрыто;
предупреждение у шаблона, не влезающего в часы. Нужны backend :3000 и admin :5173. Запуск: python3 qa/qa_admin_hours.py"""
import json, os, re, sys, urllib.request
from datetime import datetime, timedelta, timezone
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
    print(("PASS " if cond else "FAIL ") + name + (" | " + str(detail)[:400] if detail and not cond else ""))
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
    st, me = api("GET", "/businesses/mine", token=sess["accessToken"]); return (me[0] if isinstance(me, list) else me)
msg = lambda d: json.dumps(d, ensure_ascii=False)
MSK = timezone(timedelta(hours=3)); now = datetime.now(MSK).replace(second=0, microsecond=0)
iso = lambda dt: dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
hm = lambda dt: dt.strftime("%H:%M")

owner = login("bulka.arbat@apetite.ru"); other = login("cafe.pushkin@apetite.ru"); admin = login("admin@apetite.ru"); user = login("user@apetite.ru")
biz = my_business(owner); BID = biz["id"]; OT = owner["accessToken"]; ORIGINAL = biz.get("workingHours")
TAG = "QA часы " + os.urandom(2).hex()
created_offers, created_schedules = [], []

def hours_now(open_dt, close_dt):
    """Только день, в который попадает open_dt, рабочий: open_dt → close_dt (за полночь — сам собой)."""
    h = {str(i): None for i in range(1, 8)}; h[str(open_dt.isoweekday())] = {"open": hm(open_dt), "close": hm(close_dt)}; return h
OPEN, CLOSE = now - timedelta(hours=2), now + timedelta(hours=5)
def set_hours(h, tok=None):
    return api("PUT", f"/businesses/{BID}/working-hours", {"workingHours": h}, tok or OT)
def offer_body(suffix, start, end, **over):
    b = dict(businessId=BID, title=f"{TAG} {suffix}", category="BAKERY", originalPriceRub=300, baseDiscountPercent=40, weightKg=0.3, quantityTotal=3, ingredients="Мука", allergens=[],
             bestBefore=iso(end + timedelta(hours=6)), pickupStart=iso(start), pickupEnd=iso(end)); b.update(over); return b
def make(suffix, start, end, **over):
    st, o = api("POST", "/offers", offer_body(suffix, start, end, **over), OT)
    if st in (200, 201): created_offers.append(o["id"])
    return st, o
def sched_body(suffix, start_dt, end_dt, days, **over):
    b = dict(businessId=BID, title=f"{TAG} {suffix}", category="BAKERY", originalPriceRub=300, baseDiscountPercent=40, weightKg=0.3, quantityTotal=3, ingredients="Мука", allergens=[], bestBeforeHoursAfterEnd=6,
             daysOfWeek=days, pickupStartTime=hm(start_dt), pickupEndTime=hm(end_dt), publishLeadMinutes=180, timezone="Europe/Moscow", discountMode="FIXED"); b.update(over); return b

try:
    # ---------- API: права и формат ----------
    st, _ = api("PUT", f"/businesses/{BID}/working-hours", {"workingHours": None}); check("без токена — 401", st == 401, st)
    st, _ = set_hours(None, user["accessToken"]); check("покупатель — 403", st == 403, st)
    st, _ = set_hours(None, other["accessToken"]); check("владелец другого заведения — 403", st == 403, st)
    for name, bad in (("пустой объект", {}), ("все дни выходные", {str(i): None for i in range(1, 8)}), ("время без нуля", {"1": {"open": "9:00", "close": "18:00"}}), ("день 8", {"8": {"open": "09:00", "close": "18:00"}}), ("не объект", "10-20"), ("день — строка", {"1": "10-20"})):
        st, d = set_hours(bad); check(f"формат: {name} — 400", st == 400, (st, d))
    st, d = set_hours(hours_now(OPEN, CLOSE)); check("валидные часы сохраняются; в ответе заведение и список конфликтов", st == 200 and d["business"]["workingHours"][str(OPEN.isoweekday())]["open"] == hm(OPEN) and d["conflicts"] == {"offers": [], "schedules": []}, (st, d))
    st, d = api("GET", f"/businesses/{BID}", token=OT); check("часы приходят и в карточке заведения", d.get("workingHours", {}).get(str(OPEN.isoweekday())) is not None and d.get("timezone") == "Europe/Moscow", d)

    # ---------- API: офферы ----------
    st, o_in = make("внутри", now, now + timedelta(hours=3)); check("окно внутри часов — оффер создан", st in (200, 201), (st, o_in))
    st, d = make("после закрытия", now, now + timedelta(hours=6)); check(f"конец после закрытия — 400 «закрывается в {hm(CLOSE)}»", st == 400 and f"закрывается в {hm(CLOSE)}" in msg(d), (st, d))
    st, d = make("до открытия", now - timedelta(hours=3), now + timedelta(hours=1)); check("начало до открытия — 400", st == 400 and re.search(r"открывается|не работает|уже закрыто", msg(d)) is not None, (st, d))
    st, d = make("выходной", now + timedelta(hours=20), now + timedelta(hours=23)); check("в выходной день — 400 «не работает»/закрыто", st == 400 and re.search(r"не работает|уже закрыто|открывается", msg(d)) is not None, (st, d))
    exact_end = CLOSE
    st, d = make("ровно до закрытия", now, exact_end); check("конец ровно в момент закрытия — можно", st in (200, 201), (st, d))
    # правка
    st, d = api("PATCH", f"/offers/{o_in['id']}", {"title": TAG + " внутри-2", "pickupStart": iso(now), "pickupEnd": iso(now + timedelta(hours=3))}, OT); check("правка названия с тем же окном проходит", st == 200, (st, d))
    st, d = api("PATCH", f"/offers/{o_in['id']}", {"pickupEnd": iso(now + timedelta(hours=7))}, OT); check("перенос конца за закрытие — 400", st == 400 and "закрывается" in msg(d), (st, d))
    st, d = api("PATCH", f"/offers/{o_in['id']}", {"pickupEnd": iso(now + timedelta(hours=4))}, OT); check("перенос внутрь часов — можно", st == 200, (st, d))

    # ---------- API: шаблоны ----------
    wd = OPEN.isoweekday(); other_wd = (wd % 7) + 1
    st, s_ok = api("POST", "/offer-schedules", sched_body("шаблон-в-часах", OPEN + timedelta(minutes=30), OPEN + timedelta(hours=2), [wd]), OT)
    check("шаблон внутри часов — создан", st in (200, 201), (st, s_ok));
    if st in (200, 201): created_schedules.append(s_ok["id"])
    st, d = api("POST", "/offer-schedules", sched_body("шаблон-в-выходной", OPEN + timedelta(minutes=30), OPEN + timedelta(hours=2), [wd, other_wd]), OT); check("шаблон с выходным днём — 400 «не работает»", st == 400 and "не работает" in msg(d), (st, d))
    st, d = api("POST", "/offer-schedules", sched_body("шаблон-за-закрытием", OPEN + timedelta(hours=1), CLOSE + timedelta(hours=2), [wd]), OT); check("шаблон, выходящий за закрытие — 400", st == 400 and "закрывается" in msg(d), (st, d))
    st, d = api("POST", "/offer-schedules", sched_body("шаблон-пояс", OPEN + timedelta(minutes=30), OPEN + timedelta(hours=2), [wd], timezone="Asia/Vladivostok"), OT); check("шаблон в чужом поясе — 400 про часовой пояс заведения", st == 400 and "часовому поясу заведения" in msg(d), (st, d))

    # ---------- API: сужение часов → конфликты, ничего не удаляется ----------
    narrow_close = now + timedelta(hours=2)  # оффер «внутри» (до now+4h) и шаблон (до OPEN+2h = now) — оффер не влезает; шаблон проверим отдельно
    st, d = set_hours(hours_now(OPEN, narrow_close)); c = d["conflicts"]
    check("сужение часов: активный оффер, не влезающий в новые часы, назван в conflicts.offers", st == 200 and any(x["id"] == o_in["id"] and "закрывается" in x["reason"] for x in c["offers"]), (st, c))
    st, got = api("GET", f"/offers/{o_in['id']}", token=OT); check("…но сам оффер не тронут: активен, окно прежнее", got["status"] == "ACTIVE" and got["pickupEnd"].startswith(iso(now + timedelta(hours=4))[:16]), got.get("status"))
    st, d = set_hours(hours_now(OPEN + timedelta(hours=3), CLOSE)); c = d["conflicts"]
    check("сдвиг открытия: шаблон «внутри» теперь не влезает — назван в conflicts.schedules", any(x["id"] == s_ok["id"] and "открывается" in x["reason"] for x in c["schedules"]), c)

    # ---------- автовыкладка пропускает то, что не влезает ----------
    soon_start = now + timedelta(minutes=10); soon_end = now + timedelta(hours=1, minutes=10)
    st, d = set_hours(hours_now(OPEN, CLOSE))
    st, s_due = api("POST", "/offer-schedules", sched_body("шаблон-к-выкладке", soon_start, soon_end, [soon_start.isoweekday()]), OT)
    check("шаблон «через 10 минут» принят (влезает в часы)", st in (200, 201), (st, s_due))
    if st in (200, 201):
        created_schedules.append(s_due["id"])
        set_hours(hours_now(OPEN, now + timedelta(minutes=30)))  # закрытие раньше конца окна шаблона
        st, res = api("POST", "/scheduler/run-schedules", token=admin["accessToken"])
        st, lst = api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT)
        check("автовыкладка не создала оффер, выходящий за закрытие", not [x for x in lst["items"] if x["title"] == f"{TAG} шаблон-к-выкладке"], res)
        check("в итоге прогона видно число пропущенных из-за часов работы", isinstance(res, dict) and res.get("skippedOutsideHours", 0) >= 1, res)
        set_hours(hours_now(OPEN, CLOSE))
        api("POST", "/scheduler/run-schedules", token=admin["accessToken"])
        st, lst = api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT); mine = [x for x in lst["items"] if x["title"] == f"{TAG} шаблон-к-выкладке"]; created_offers += [x["id"] for x in mine]
        check("вернули нормальные часы — тот же шаблон выкладывается", len(mine) == 1, mine)

    # ---------- null снимает ограничение ----------
    st, d = api("PUT", f"/businesses/{BID}/working-hours", {"workingHours": None}, OT); check("null снимает ограничение по часам", st == 200 and d["business"]["workingHours"] is None, (st, d))
    st, d = make("без часов", now, now + timedelta(hours=8)); check("без заданных часов действуют лишь общие правила (окно 8 ч — можно)", st in (200, 201), (st, d))

    # ---------- кабинет ----------
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={"width": 1360, "height": 1100}, timezone_id="Europe/Moscow", locale="ru-RU"); page = ctx.new_page(); errs = []; dialogs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200])); page.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
        page.goto(ADMIN + "/login"); page.evaluate("([a, r]) => { localStorage.clear(); localStorage.setItem('apetite.admin.accessToken', a); localStorage.setItem('apetite.admin.refreshToken', r); }", [owner["accessToken"], owner["refreshToken"]])
        page.goto(ADMIN + "/offers"); card = page.get_by_test_id("working-hours-card"); card.wait_for(timeout=20000)
        check("часов нет — карточка призывает «Укажите часы работы»", "Укажите часы работы" in card.inner_text() and card.get_by_role("button", name="Указать часы работы").count() == 1)
        page.screenshot(path=f"{OUT}/admin_hours_empty.png")
        card.get_by_role("button", name="Указать часы работы").click(); page.wait_for_selector("text=Часы работы >> visible=true")
        rows = page.locator("[data-day]")
        check("редактор: семь дней, по умолчанию 10:00–22:00 каждый день", rows.count() == 7 and rows.nth(0).locator("input[type=time]").nth(0).input_value() == "10:00" and rows.nth(6).locator("input[type=time]").nth(1).input_value() == "22:00")
        rows.nth(6).get_by_role("checkbox").uncheck(); page.wait_for_timeout(100)
        check("снятая галочка = выходной", rows.nth(6).get_by_text("выходной").count() == 1)
        rows.nth(5).locator("input[type=time]").nth(0).fill("11:00"); rows.nth(5).locator("input[type=time]").nth(1).fill("02:00"); page.wait_for_timeout(100)
        check("закрытие раньше открытия — подсказка «до 02:00 следующего дня»", "до 02:00 следующего дня" in rows.nth(5).inner_text())
        page.screenshot(path=f"{OUT}/admin_hours_modal.png")
        page.get_by_role("button", name="Сохранить часы работы").click(); page.wait_for_selector("text=Часы работы сохранены", timeout=10000)
        check("сохранено: «Всё выложенное укладывается…» (конфликтов нет)", page.get_by_text("укладывается в новые часы").count() == 1 or page.get_by_text("не влезает").count() >= 1)
        page.get_by_role("button", name="Понятно").click(); page.wait_for_timeout(300)
        check("карточка показывает сжатую подпись", "пн–пт 10:00–22:00" in page.get_by_test_id("working-hours-summary").inner_text() and "сб 11:00–02:00" in page.get_by_test_id("working-hours-summary").inner_text() and "вс выходной" in page.get_by_test_id("working-hours-summary").inner_text(), page.get_by_test_id("working-hours-summary").inner_text())
        st, cur = api("GET", f"/businesses/{BID}", token=OT); check("и на сервере сохранились те же часы", cur["workingHours"]["6"] == {"open": "11:00", "close": "02:00"} and cur["workingHours"]["7"] is None, cur.get("workingHours"))
        page.screenshot(path=f"{OUT}/admin_hours_card.png")

        # часы «от сейчас» для форм: открыты сейчас…через 3 часа
        set_hours(hours_now(OPEN, now + timedelta(hours=3))); page.reload(); page.get_by_test_id("working-hours-card").wait_for(timeout=15000)
        check("«Сейчас открыто — сегодня самовывоз можно назначать до HH:MM»", f"до {hm(now + timedelta(hours=3))}" in page.get_by_test_id("working-hours-card").inner_text(), page.get_by_test_id("working-hours-card").inner_text())
        page.get_by_role("button", name="+ Новый оффер").click(); page.wait_for_selector("text=Новый оффер")
        check("в форме оффера есть подсказка про часы работы в этот день", "Часы работы в этот день" in page.get_by_test_id("window-hint").inner_text(), page.get_by_test_id("window-hint").inner_text())
        page.fill("#title", TAG + " форма"); page.fill("#price", "400"); page.fill("#weight", "0.3"); page.fill("#quantity", "3")
        loc = lambda dt: dt.strftime("%Y-%m-%dT%H:%M")
        page.fill("#pickupStart", loc(now)); page.fill("#pickupEnd", loc(now + timedelta(hours=6)))
        page.fill("#offer-ingredients", "Тесто"); page.locator("#offer-allergens").click(); page.get_by_role("checkbox", name="Аллергенов нет", exact=True).check(); page.keyboard.press("Escape")
        page.get_by_role("button", name="Сохранить").click(); page.wait_for_timeout(700)
        err = page.locator(".form-error").all_inner_texts()
        check("конец после закрытия: форма не уходит на сервер и говорит «закрывается в HH:MM»", any(f"закрывается в {hm(now + timedelta(hours=3))}" in e for e in err), err)
        check("…оффер не создан", not [x for x in api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT)[1]["items"] if x["title"] == TAG + " форма"])
        page.fill("#pickupEnd", loc(now + timedelta(hours=2))); page.get_by_role("button", name="Сохранить").click(); page.wait_for_timeout(1500)
        mine = [x for x in api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT)[1]["items"] if x["title"] == TAG + " форма"]; created_offers += [x["id"] for x in mine]
        check("окно внутри часов — оффер создан из формы", len(mine) == 1, mine)
        page.screenshot(path=f"{OUT}/admin_hours_form_error.png")

        # быстрое создание: режет конец по закрытию
        set_hours(hours_now(OPEN, now + timedelta(minutes=70)))  # до закрытия ~70 минут (меньше обычных 2 часов)
        page.reload(); page.wait_for_selector("#quick-title", timeout=15000)
        page.fill("#quick-title", TAG + " быстро"); page.fill("#quick-price", "500"); page.fill("#quick-weight", "0.4"); page.fill("#quick-ingredients", "Лаваш, курица")
        page.locator("#quick-allergens").click(); page.get_by_role("checkbox", name="Аллергенов нет", exact=True).check(); page.keyboard.press("Escape")
        page.get_by_role("button", name="Опубликовать").click(); page.wait_for_timeout(1800)
        quick = [x for x in api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT)[1]["items"] if x["title"] == TAG + " быстро"]; created_offers += [x["id"] for x in quick]
        end_ok = bool(quick) and abs((datetime.fromisoformat(quick[0]["pickupEnd"].replace("Z", "+00:00")) - (now + timedelta(minutes=70)).astimezone(timezone.utc)).total_seconds()) < 90
        check("быстрое создание: конец окна обрезан по закрытию (≈ через 70 минут, а не 2 часа)", end_ok, quick[:1] and quick[0]["pickupEnd"])
        set_hours(hours_now(OPEN - timedelta(hours=10), OPEN - timedelta(hours=4)))  # сейчас закрыто
        page.reload(); page.wait_for_selector("#quick-title", timeout=15000)
        page.fill("#quick-title", TAG + " закрыто"); page.fill("#quick-price", "500"); page.fill("#quick-weight", "0.4"); page.fill("#quick-ingredients", "Лаваш, курица")
        page.locator("#quick-allergens").click(); page.get_by_role("checkbox", name="Аллергенов нет", exact=True).check(); page.keyboard.press("Escape")
        page.get_by_role("button", name="Опубликовать").click(); page.wait_for_timeout(800)
        check("быстрое создание, когда заведение закрыто: понятный отказ, оффер не создан", page.get_by_text("Сейчас заведение закрыто").count() == 1 and not [x for x in api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT)[1]["items"] if x["title"] == TAG + " закрыто"])
        check("и карточка часов говорит «Сейчас закрыто»", "Сейчас закрыто" in page.get_by_test_id("working-hours-card").inner_text())

        # предупреждение у шаблона, не влезающего в часы
        set_hours(hours_now(OPEN + timedelta(hours=3), CLOSE)); page.reload(); page.wait_for_selector("text=Автовыкладка", timeout=15000); page.wait_for_timeout(1200)
        warn = page.get_by_test_id("schedule-hours-warning")
        check("шаблон вне часов работы помечен: «Не выкладывается: …»", warn.count() >= 1 and "Не выкладывается" in warn.first.inner_text(), warn.count())
        page.screenshot(path=f"{OUT}/admin_hours_schedule_warning.png")
        check("нет JS-ошибок в кабинете", not errs, errs[:2])
        b.close()
finally:
    for sid in created_schedules: api("DELETE", f"/offer-schedules/{sid}", token=OT)
    st, d = api("GET", f"/offers?businessId={BID}&pageSize=100", token=OT)
    for x in (d["items"] if st == 200 else []):
        if x["title"].startswith(TAG): api("DELETE", f"/offers/{x['id']}", token=OT)
    api("PUT", f"/businesses/{BID}/working-hours", {"workingHours": ORIGINAL}, OT)  # вернуть исходные часы заведения

print(f"\n{'FAILED: ' + str(len(fails)) if fails else 'ALL PASSED'}"); sys.exit(1 if fails else 0)
