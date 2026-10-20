"""Админка на РЕАЛЬНОМ backend: «Состав и срок годности» в быстром создании и в полной форме, пометка «нет состава» у старых офферов,
счётчик оспоренных заказов. Сид-аккаунты из prisma/seed.ts, только localhost. Нужны backend :3000, admin :5173, docker (psql для «старого» оффера).
Создаёт тестовые офферы «QA админ-состав …» и в конце удаляет. Запуск: python3 qa/qa_admin_food.py"""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

API = os.environ.get("API_URL", "http://localhost:3000/api/v1"); ADMIN = os.environ.get("ADMIN_URL", "http://localhost:5173"); OUT = os.environ.get("QA_OUT", "/tmp")
for u in (API, ADMIN):
    if urlparse(u).hostname not in ("localhost", "127.0.0.1", "::1"): sys.exit(f"Отказ: {u} — не локальный адрес.")
PASSWORD = os.environ.get("QA_PASSWORD", "password123")  # демо-аккаунты из prisma/seed.ts
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
    st, d = api("POST", "/auth/login", {"identifier": email, "password": PASSWORD}); assert st in (200, 201), (email, st, d); return d
def psql(sql):
    env = dict(l.split("=", 1) for l in open(os.path.join(os.path.dirname(__file__), "..", ".env")).read().splitlines() if "=" in l and not l.startswith("#"))
    r = subprocess.run(["docker", "exec", "apetite-postgres-1", "psql", "-U", env["POSTGRES_USER"], "-d", env["POSTGRES_DB"], "-c", sql], capture_output=True, text=True); return r.returncode == 0, r.stderr

owner = login(os.environ.get("QA_BUSINESS", "cafe.pushkin@apetite.ru")); adm = login(os.environ.get("QA_ADMIN", "admin@apetite.ru")); tok = owner["accessToken"]
TAG = "QA админ-состав " + os.urandom(2).hex()
created = []
def mine(): st, d = api("GET", "/offers?pageSize=100&businessId=" + biz["id"]); return [o for o in d["items"] if o["title"].startswith(TAG)]
st, bs = api("GET", "/businesses/mine", token=tok); biz = bs[0] if isinstance(bs, list) else bs

def axe(page, label):
    try:
        from axe_playwright_python.sync_playwright import Axe
    except ImportError: print("SKIP axe"); return
    bad = [v["id"] for v in Axe().run(page, options={"runOnly": {"type": "tag", "values": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]}}).response["violations"]]
    check(f"axe: {label} — 0 нарушений WCAG AA", not bad, bad)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={"width": 1360, "height": 1000}); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(ADMIN + "/login"); page.evaluate("([a, r]) => { localStorage.setItem('apetite.admin.accessToken', a); localStorage.setItem('apetite.admin.refreshToken', r); }", [owner["accessToken"], owner["refreshToken"]])
        page.goto(ADMIN + "/offers"); page.wait_for_selector("text=Быстрое создание", timeout=20000)

        # ───────── быстрое создание ─────────
        q = page.locator("form.card", has_text="Быстрое создание")
        check("быстрое создание: компактный блок — состав, ОДНА кнопка «Аллергены» (список скрыт) и «Годен до» в одной строке", q.get_by_text("Состав и срок годности").count() == 1 and q.locator("#quick-allergens").count() == 1 and q.locator("input[type=checkbox]").count() == 0 and q.locator("#quick-best-before").count() == 1)
        ab, bbx = q.locator("#quick-allergens").bounding_box(), q.locator("#quick-best-before").bounding_box()
        check("кнопка аллергенов и «Годен до» стоят рядом, а не друг под другом", abs(ab["y"] - bbx["y"]) < 20, (ab, bbx))
        check("на кнопке написано «Выбрать», пока ничего не выбрано", "Выбрать" in q.locator("#quick-allergens").inner_text())
        bb = q.locator("#quick-best-before").input_value()
        check("«Годен до» заполнен по умолчанию (конец самовывоза + 4 часа): заведению не нужно вводить его каждый раз", re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d", bb) is not None, bb)
        page.fill("#quick-title", TAG + " A"); page.fill("#quick-price", "500"); page.fill("#quick-weight", "0.4")
        before = len(mine()); q.get_by_role("button", name="Опубликовать").click(); page.wait_for_timeout(600)
        check("без состава оффер не создаётся (поле обязательно)", len(mine()) == before and page.evaluate("document.querySelector('#quick-ingredients').validity.valueMissing"))
        page.fill("#quick-ingredients", "Лаваш, курица, огурцы, соус"); q.get_by_role("button", name="Опубликовать").click(); page.wait_for_timeout(600)
        check("состав есть, аллергены не выбраны — понятная ошибка, оффер не создан", "Отметь аллергены или выбери «Аллергенов нет»" in q.inner_text() and len(mine()) == before, q.inner_text()[-200:])
        trig = q.locator("#quick-allergens"); trig.click(); page.wait_for_selector("#quick-allergens-panel")
        check("список раскрылся: «Аллергенов нет» + 14 аллергенов, кнопка помечена aria-expanded", q.locator("#quick-allergens-panel input[type=checkbox]").count() == 15 and trig.get_attribute("aria-expanded") == "true")
        page.screenshot(path=os.path.join(OUT, "admin_food_dropdown.png"))
        none_box = q.get_by_role("checkbox", name="Аллергенов нет", exact=True); gluten = q.get_by_role("checkbox", name="Глютен (злаки)", exact=True); milk = q.get_by_role("checkbox", name="Молоко и лактоза", exact=True)
        gluten.check(); none_box.check()
        check("«Аллергенов нет» снимает выбранные аллергены", not gluten.is_checked() and none_box.is_checked())
        milk.check()
        check("выбор аллергена снимает «Аллергенов нет»", milk.is_checked() and not none_box.is_checked())
        gluten.check()
        page.keyboard.press("Escape"); page.wait_for_timeout(200)
        check("Esc закрывает список и возвращает фокус на кнопку", q.locator("#quick-allergens-panel").count() == 0 and page.evaluate("document.activeElement.id") == "quick-allergens")
        check("на кнопке итог выбора («Молоко и лактоза, Глютен (злаки)»), под ней — чипы с крестиками", "Молоко и лактоза, Глютен (злаки)" in trig.inner_text() and q.get_by_role("button", name="Убрать: Молоко и лактоза").count() == 1)
        trig.click(); page.mouse.click(5, 5); page.wait_for_timeout(200)
        check("клик вне списка тоже закрывает его", q.locator("#quick-allergens-panel").count() == 0)
        q.get_by_role("button", name="Убрать: Молоко и лактоза").click(); page.wait_for_timeout(100); q.locator("#quick-allergens").click(); q.get_by_role("checkbox", name="Молоко и лактоза", exact=True).check(); page.keyboard.press("Escape")
        page.screenshot(path=os.path.join(OUT, "admin_food_quick.png")); axe(page, "быстрое создание с составом")
        q.get_by_role("button", name="Опубликовать").click(); page.wait_for_timeout(1800)
        o = [x for x in mine() if x["title"] == TAG + " A"]
        check("оффер создан с составом и двумя аллергенами", len(o) == 1 and o[0]["ingredients"] == "Лаваш, курица, огурцы, соус" and sorted(o[0]["allergens"]) == ["gluten", "milk"] and o[0]["allergensDeclared"], o)
        if o:
            created.append(o[0]["id"])
            gap = (time.mktime(time.strptime(o[0]["bestBefore"][:19], "%Y-%m-%dT%H:%M:%S")) - time.mktime(time.strptime(o[0]["pickupEnd"][:19], "%Y-%m-%dT%H:%M:%S"))) / 3600
            check("срок годности по умолчанию = конец самовывоза + 4 ч", abs(gap - 4) < 0.1, gap)
        check("после публикации форма очищена и снова с «Годен до» по умолчанию", page.locator("#quick-ingredients").input_value() == "" and q.locator("#quick-best-before").input_value() != "")

        # «Аллергенов нет» тоже публикуется
        page.fill("#quick-title", TAG + " B"); page.fill("#quick-price", "300"); page.fill("#quick-weight", "0.3"); page.fill("#quick-ingredients", "Картофель, масло, соль")
        q.locator("#quick-allergens").click(); q.get_by_role("checkbox", name="Аллергенов нет", exact=True).check(); page.keyboard.press("Escape")
        check("«Аллергенов нет» отражается на кнопке", "Аллергенов нет" in q.locator("#quick-allergens").inner_text())
        q.get_by_role("button", name="Опубликовать").click(); page.wait_for_timeout(1800)
        o = [x for x in mine() if x["title"] == TAG + " B"]
        check("«Аллергенов нет» публикуется: пустой список и отметка «заявлено»", len(o) == 1 and o[0]["allergens"] == [] and o[0]["allergensDeclared"] is True, o)
        if o: created.append(o[0]["id"])

        # ───────── полная форма (правка) ─────────
        page.reload(); page.wait_for_selector(f"tr:has-text('{TAG} A')")
        page.locator(f"tr:has-text('{TAG} A')").get_by_role("button", name="Изменить").click(); page.wait_for_selector("[role=dialog]"); dlg = page.locator("[role=dialog]")
        check("правка: состав подставлен, на кнопке аллергенов — выбранные", dlg.locator("#offer-ingredients").input_value() == "Лаваш, курица, огурцы, соус" and "Глютен" in dlg.locator("#offer-allergens").inner_text() and "Молоко" in dlg.locator("#offer-allergens").inner_text())
        sug = dlg.get_by_label("Подставить состав из прежнего предложения")
        check("в правке есть «Подставить из прежних…» (из офферов заведения с составом)", sug.count() == 1 and sug.locator("option").count() >= 2, sug.count())
        page.screenshot(path=os.path.join(OUT, "admin_food_edit.png")); axe(page, "форма правки с составом")
        dlg.locator("#offer-best-before").fill("2020-01-01T10:00")
        check("«Годен до» раньше конца самовывоза браузер не пропускает (min = конец самовывоза)", page.evaluate("document.querySelector('#offer-best-before').validity.rangeUnderflow"))
        dlg.locator("#category").select_option("FLOWERS"); page.wait_for_timeout(200)
        check("категория «Цветы»: блок состава скрывается — он цветам не нужен", dlg.get_by_text("Состав и срок годности").count() == 0)
        dlg.locator("#category").select_option("FOOD"); page.wait_for_timeout(200)
        check("обратно «Еда»: блок возвращается", dlg.get_by_text("Состав и срок годности").count() == 1)
        dlg.locator("#offer-allergens").click(); dlg.get_by_role("checkbox", name="Молоко и лактоза", exact=True).uncheck(); page.keyboard.press("Escape"); dlg.locator("#offer-ingredients").fill("Лаваш, говядина"); dlg.locator("#offer-best-before").fill(page.evaluate("document.querySelector('#pickupEnd').value").replace(":00", ":00"))
        dlg.get_by_role("button", name="Сохранить").click(); page.wait_for_selector("[role=dialog]", state="detached", timeout=8000)
        st, got = api("GET", "/offers/" + created[0])
        check("правка сохранена: новый состав и аллергены", got["ingredients"] == "Лаваш, говядина" and got["allergens"] == ["gluten"], got)

        # ───────── старый оффер без состава ─────────
        ok, err = psql(f"UPDATE offers SET ingredients=NULL, \"allergensDeclared\"=false, allergens='{{}}', \"bestBefore\"=NULL WHERE id='{created[1]}'")
        check("(подготовка) оффер превращён в «старый» без состава через psql", ok, err)
        page.reload(); page.wait_for_selector(f"tr:has-text('{TAG} B')")
        row = page.locator(f"tr:has-text('{TAG} B')")
        check("у старого оффера в таблице пометка «нет состава»", row.get_by_text("нет состава").count() == 1)
        check("у офферов с составом пометки нет", page.locator(f"tr:has-text('{TAG} A')").get_by_text("нет состава").count() == 0)
        st, d = api("PATCH", f"/offers/{created[1]}", {"originalPriceRub": 350}, tok)
        check("старый оффер можно править по цене без состава (API не блокирует)", st == 200, d)
        row.get_by_role("button", name="Изменить").click(); page.wait_for_selector("[role=dialog]")
        dlg = page.locator("[role=dialog]"); check("в правке старого оффера форма просит заполнить состав (поле пустое)", dlg.locator("#offer-ingredients").input_value() == "")
        dlg.locator("#offer-ingredients").fill("Картофель, масло, соль"); dlg.locator("#offer-allergens").click(); dlg.get_by_role("checkbox", name="Аллергенов нет", exact=True).check(); page.keyboard.press("Escape")
        dlg.get_by_role("button", name="Сохранить").click(); page.wait_for_selector("[role=dialog]", state="detached", timeout=8000); page.wait_for_timeout(600)
        check("после заполнения пометка «нет состава» пропадает", page.locator(f"tr:has-text('{TAG} B')").get_by_text("нет состава").count() == 0)

        # ───────── счётчик споров ─────────
        page.evaluate("([a, r]) => { localStorage.setItem('apetite.admin.accessToken', a); localStorage.setItem('apetite.admin.refreshToken', r); }", [adm["accessToken"], adm["refreshToken"]])
        page.goto(ADMIN + "/platform/stats"); page.wait_for_selector("text=Заказы по статусам", timeout=15000)
        check("статистика платформы: есть «Оспорено покупателем»", page.get_by_text("Оспорено покупателем").count() == 1)
        st, ps = api("GET", "/platform/stats", token=adm["accessToken"])
        check("число на экране совпадает с API", str(ps["disputedOrders"]) in page.locator("text=Оспорено покупателем").locator("xpath=..").inner_text(), ps["disputedOrders"])
        check("консоль без ошибок", not errs, errs[:3]); b.close()
finally:
    for oid in created:
        st, d = api("DELETE", f"/offers/{oid}", token=tok)
        if st >= 400: api("PATCH", f"/offers/{oid}", {"status": "ARCHIVED"}, tok)
print("\nFAILS:", fails); sys.exit(1 if fails else 0)
