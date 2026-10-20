"""QA вкладки «Карта» мобильного web-приложения на ЗАМОКАННОМ API: сеть и пароли не нужны.
Карта (Leaflet) на весь экран + стеклянная шапка + лента компактных карточек предложений: синхронный выбор пин ↔ карточка,
«тап по соседней выбирает, по выбранной открывает», листание, клавиатура, список, геопозиция, пустое состояние, раскладка.
Запуск: python3 qa/qa_mobile_map.py (нужен mobile-web на :8081). Скриншоты — в QA_OUT."""
import json, os, re, sys, tempfile
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright

BASE = os.environ.get("MOBILE_URL", "http://localhost:8081")
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())
NOW = datetime.now(timezone.utc)
iso = lambda mins: (NOW + timedelta(minutes=mins)).isoformat().replace("+00:00", "Z")
results = []

def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))

PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")

def offer(i, title, venue, lat, lng, dist, end_in=60, disc=50, left=5, price=30000):
    return {"id": f"off-{i}", "businessId": f"biz-{i}", "title": title, "description": "Описание", "category": "FOOD", "originalPrice": price * 100 // (100 - disc),
            "discountedPrice": price, "discountPercent": disc, "baseDiscountPercent": 25, "imageUrl": None, "quantityTotal": 10, "quantityLeft": left, "weightKg": 0.5,
            "pickupStart": iso(-90), "pickupEnd": iso(end_in), "status": "ACTIVE", "featured": False, "createdAt": iso(-200), "updatedAt": iso(-1),
            "businessName": venue, "businessAddress": "Невский 1", "businessLat": lat, "businessLng": lng, "businessLogoUrl": None, "distanceKm": dist,
            "ingredients": "Мука, вода, сыр", "allergens": ["gluten"], "allergensDeclared": True, "bestBefore": iso(end_in + 240)}

# Намеренно в «неудобном» порядке по расстоянию: карточки обязаны выстроиться ближайшими первыми.
OFFERS = [
    offer(1, "Хачапури по-аджарски", "Кавказская кухня", 59.9345, 30.3500, 2.4, 300, 35, price=32000),
    offer(2, "Шаурма классическая", "Shava Point", 59.9322, 30.3612, 0.2, 50, 60, price=15000),
    offer(3, "Набор десертов дня", "Кафе Пушкинъ", 59.9390, 30.3300, 3.1, 120, 45, price=24000),
    offer(4, "Пицца Маргарита", "Pizza Point", 59.9280, 30.3700, 0.9, 35, 55, price=29000),
    offer(5, "Бизнес-ланч", "Столовая №1", 59.9400, 30.3900, 1.7, 200, 40, price=25000),
    offer(6, "Закрытое предложение", "Не должно быть на карте", 59.93, 30.36, 0.1, -10, 70),
    offer(7, "Раскуплено", "Не должно быть на карте", 59.93, 30.36, 0.1, 90, 70, left=0),
]
EXPECTED_ORDER = ["Шаурма классическая", "Пицца Маргарита", "Бизнес-ланч", "Хачапури по-аджарски", "Набор десертов дня"]
USER = {"id": "u1", "email": "qa@example.test", "phone": "+79990001122", "name": "Тест Тестович", "avatarUrl": None, "role": "USER", "notifyRadiusKm": 5, "createdAt": iso(-60 * 24 * 30), "updatedAt": iso(-5)}

def install_api(ctx, st):
    def handler(route, request):
        path = re.sub(r"^https?://[^/]+/api/v1", "", request.url).split("?")[0]
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
        def ok(data, status=200): route.fulfill(status=status, content_type="application/json", body=json.dumps(data), headers={"access-control-allow-origin": "*"})
        st["calls"].append((request.method, path))
        if path == "/auth/me": return ok(USER)
        if path == "/offers/nearby": return ok([] if st.get("empty") else OFFERS)
        mo = re.match(r"^/offers/([^/]+)$", path)
        if mo:
            found = next((o for o in OFFERS if o["id"] == mo.group(1)), None)
            return ok(found) if found else ok({"statusCode": 404, "message": "Оффер не найден"}, 404)
        mb = re.match(r"^/businesses/([^/]+)$", path)
        if mb: return ok({"id": mb.group(1), "ownerUserId": "u9", "name": "Заведение", "address": "Невский 1", "category": "FOOD", "lat": 59.93, "lng": 30.36, "status": "ACTIVE", "commissionPercent": 10, "createdAt": iso(-9999), "updatedAt": iso(-9999)})
        if path == "/orders": return ok([])
        if path == "/notifications": return ok({"items": [], "total": 0, "page": 1, "pageSize": 50})
        if path in ("/users/me/location", "/notifications/push-token"): return ok({"success": True})
        return ok({"statusCode": 404, "message": f"unmocked {request.method} {path}"}, 404)
    ctx.route("**/api/v1/**", handler)
    ctx.route(re.compile(r"https://[a-c]?\.?tile\.openstreetmap\.org/.*|https://.*\.tile\.openstreetmap\.org/.*"), lambda route, request: route.fulfill(status=200, content_type="image/png", body=PNG))

def new_page(b, vp=None, scheme="light", geo=True, reduced=False, empty=False):
    st = {"calls": [], "empty": empty}
    ctx = b.new_context(viewport=vp or {"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme=scheme, locale="ru-RU",
                        reduced_motion="reduce" if reduced else "no-preference", geolocation={"latitude": 59.9311, "longitude": 30.3609} if geo else None, permissions=["geolocation"] if geo else [])
    ctx.add_init_script("localStorage.setItem('apetite.accessToken','fake.a.b'); localStorage.setItem('apetite.refreshToken','fake.r.b');")
    install_api(ctx, st)
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:160]))
    page.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" and not re.search("vibrate|collapsable|transform-origin|Failed to load resource|non-boolean|Invalid DOM|tile|ERR_", m.text) else None)
    return ctx, page, st, errs

def open_map(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.get_by_role("tab", name="Карта").click(timeout=40000)
    page.locator(".apetite-map-fill").wait_for(timeout=20000)
    page.wait_for_timeout(1500)

RAIL = lambda page: page.get_by_role("group", name="Предложения на карте")
def rail_cards(page): return RAIL(page).get_by_role("button")
T = {i: t for i, t in enumerate(["Шаурма классическая", "Пицца Маргарита", "Бизнес-ланч", "Хачапури по-аджарски", "Набор десертов дня"])}
def titles(page): return [c.get_attribute("aria-label").split(",")[0] for c in rail_cards(page).all()]
def current(page):
    """Названия карточек, помеченных aria-current (ожидаем ровно одну) — по названию, а не по индексу: FlatList виртуализирует ленту."""
    return page.evaluate("""() => [...document.querySelectorAll('[role=group][aria-label="Предложения на карте"] [role=button]')].filter(c => c.getAttribute('aria-current') === 'true').map(c => c.getAttribute('aria-label').split(',')[0])""")
def card(page, title): return RAIL(page).get_by_role("button", name=re.compile("^" + re.escape(title)))
def marker(page, title): return page.locator(f".apetite-map-fill .apetite-marker[title^='{title}']")
# ВАЖНО: RN-web подменяет scrollTo у DOM-узла ScrollView на RN-вариант ({x, y, animated}) — настоящий DOM-скролл зовём через Element.prototype.scrollTo.
def scroller_js(): return """() => { const list = document.querySelector('[role=group][aria-label="Предложения на карте"]'); return [...list.querySelectorAll('*')].find(e => e.scrollWidth > e.clientWidth + 10 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowX)) }"""
def rect(loc): return loc.bounding_box()
def intersects(a, b): return a and b and a["x"] < b["x"] + b["width"] and b["x"] < a["x"] + a["width"] and a["y"] < b["y"] + b["height"] and b["y"] < a["y"] + a["height"]

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ---------- состав и порядок ----------
    ctx, page, st, errs = new_page(b); open_map(page)
    check("шапка: название «Карта» и число предложений без закрытых и раскупленных (5)", page.get_by_role("heading", name="Карта").count() == 1 and page.get_by_text("Предложений: 5").count() == 1)
    check("лента: подписанная группа; карточки рисуются порциями (виртуализация), пятая — по мере прокрутки", RAIL(page).count() == 1 and 4 <= rail_cards(page).count() <= 5, rail_cards(page).count())
    check("с геопозицией карточки идут ближайшими первыми", titles(page) == EXPECTED_ORDER[:len(titles(page))], titles(page))
    check("закрытые и раскупленные предложения не попали ни в ленту, ни на карту", RAIL(page).get_by_text("Не должно быть на карте").count() == 0 and page.locator(".apetite-map-fill .apetite-marker[title*='Не должно']").count() == 0 and "Закрытое" not in " ".join(titles(page)) and "Раскуплено" not in " ".join(titles(page)))
    pins = page.locator(".apetite-map-fill .apetite-marker")
    check("на карте пять пинов — по одному на карточку", pins.count() == 5, pins.count())
    check("первая карточка выбрана сразу — выбранная есть всегда, и она одна", current(page) == [T[0]], current(page))
    labels = [c.get_attribute("aria-label") for c in rail_cards(page).all()]
    check("подпись карточки: название, заведение, цена, скидка и что произойдёт при нажатии", all(re.search(r"₽, скидка \d+%", l) for l in labels) and labels[0].endswith("Открыть предложение") and all(l.endswith("Показать на карте") for l in labels[1:]), labels[:2])
    first = rect(card(page, T[0])); second = rect(card(page, T[1])); vp = page.viewport_size
    check("следующая карточка выглядывает из-за края (видно, что ленту можно листать)", second and second["x"] < vp["width"] - 12 and second["x"] + second["width"] > vp["width"], (first, second))
    check("карточка компактная: ≈112 px высотой, на карте остаётся основное место", 100 <= first["height"] <= 124, first["height"])
    mapbox = rect(page.locator(".apetite-map-fill"))
    check("карта идёт от самого верха экрана (под статус-бар) до дока вкладок", mapbox["y"] <= 1 and mapbox["height"] >= vp["height"] - 100, mapbox)
    page.screenshot(path=os.path.join(OUT, "map_390.png"))

    # ---------- пин → карточка ----------
    marker(page, "Бизнес-ланч").click(); page.wait_for_timeout(1500)
    check("тап по пину выбирает его карточку (aria-current переехал на «Бизнес-ланч»)", current(page) == [T[2]], current(page))
    cb = rect(card(page, T[2]))
    check("лента подъехала к выбранной карточке — она у левого края, а не за экраном", cb and 8 <= cb["x"] <= 60, cb)
    # Видимая полоса карты: от низа шапки до верха ленты.
    band_top = rect(page.get_by_role("heading", name="Карта"))["y"] + rect(page.get_by_role("heading", name="Карта"))["height"] - 4
    band_bottom = rect(RAIL(page))["y"] + 8
    mk = rect(marker(page, "Бизнес-ланч"))
    cy = mk["y"] + mk["height"] / 2
    check("карта перелетела к пину: он в видимой полосе между шапкой и лентой, а не под ней", band_top <= cy <= band_bottom, (cy, band_top, band_bottom))
    check("не открылся экран предложения: тап по пину только выбирает", page.get_by_role("button", name="Купить").count() == 0)
    page.screenshot(path=os.path.join(OUT, "map_390_selected.png"))

    # ---------- карточка → пин; соседняя / выбранная ----------
    card(page, T[3]).click(); page.wait_for_timeout(1500)
    check("тап по соседней карточке только выбирает её", current(page) == [T[3]] and page.get_by_role("button", name="Купить").count() == 0, current(page))
    mk = rect(marker(page, "Хачапури")); cy = mk["y"] + mk["height"] / 2
    check("…и карта летит к её пину", band_top <= cy <= band_bottom, (cy, band_top, band_bottom))
    card(page, T[3]).click(); page.get_by_role("button", name="Купить").wait_for(timeout=15000)
    check("тап по выбранной карточке открывает предложение", page.get_by_text("Хачапури по-аджарски").count() >= 1 and page.get_by_role("button", name="Купить").count() == 1)
    page.get_by_role("button", name="Назад").click(); page.wait_for_timeout(1200)
    check("из предложения «Назад» возвращает на карту с сохранённым выбором", RAIL(page).count() == 1 and current(page) == [T[3]], current(page))

    # ---------- листание ленты ----------
    page.evaluate("(js) => { const s = eval('(' + js + ')')(); Element.prototype.scrollTo.call(s, { left: 0, behavior: 'auto' }) }", scroller_js()); page.wait_for_timeout(900)
    snap = rect(card(page, T[1]))["x"] - rect(card(page, T[0]))["x"]
    page.evaluate("([js, left]) => { const s = eval('(' + js + ')')(); Element.prototype.scrollTo.call(s, { left, behavior: 'smooth' }) }", [scroller_js(), snap * 2]); page.wait_for_timeout(1500)
    check("пролистал ленту до третьей карточки — она стала выбранной", current(page) == [T[2]], current(page))
    mk = rect(marker(page, "Бизнес-ланч")); cy = mk["y"] + mk["height"] / 2
    check("…и карта следом показывает её пин", band_top <= cy <= band_bottom, cy)
    n_before = len(current(page))
    page.evaluate("([js, left]) => { const s = eval('(' + js + ')')(); Element.prototype.scrollTo.call(s, { left, behavior: 'smooth' }) }", [scroller_js(), snap * 2 + 10]); page.wait_for_timeout(900)
    check("лёгкое дрожание в пределах карточки выбор не меняет", current(page) == [T[2]] and n_before == 1, current(page))

    # ---------- клавиатура ----------
    page.evaluate("document.activeElement && document.activeElement.blur()")
    card(page, T[3]).focus(); page.wait_for_timeout(300)
    page.keyboard.press("Tab"); page.wait_for_timeout(1200)  # настоящий Tab: фокус от клавиатуры, не от указателя
    check("клавиатура: Tab на следующую карточку сразу выбирает её (карта показывает пин без нажатия)", current(page) == [T[4]] and page.get_by_role("button", name="Купить").count() == 0, current(page))
    marker(page, "Шаурма").focus(); page.keyboard.press("Enter"); page.wait_for_timeout(1200)
    check("пин с клавиатуры: Enter выбирает предложение", current(page) == [T[0]], current(page))
    ring = marker(page, "Шаурма").evaluate("e => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth")
    check("у сфокусированного пина виден контур фокуса", ring.startswith("solid") and not ring.endswith(" 0px"), ring)

    # ---------- список ↔ карта ----------
    page.get_by_role("button", name="Показать списком").click(); page.wait_for_timeout(900)
    check("«Показать списком»: карта и лента уступают место списку из пяти предложений", page.locator(".apetite-map-fill").count() == 0 and RAIL(page).count() == 0 and page.locator("[role=button]").filter(has_text="₽").count() >= 5,
          (page.locator(".apetite-map-fill").count(), page.locator("[role=button]").filter(has_text="₽").count()))
    check("кнопка в шапке сменила подпись на «Показать на карте»", page.get_by_role("button", name="Показать на карте", exact=True).count() == 1)
    page.screenshot(path=os.path.join(OUT, "map_390_list.png"))
    page.get_by_role("button", name="Показать на карте", exact=True).click(); page.locator(".apetite-map-fill").wait_for(timeout=10000); page.wait_for_timeout(1000)
    check("возврат на карту: выбор сохранился", current(page) == [T[0]] and pins.count() == 5, current(page))

    # ---------- геопозиция и атрибуция ----------
    locate = page.get_by_role("button", name="Вернуться к моему местоположению")
    check("с разрешённой геопозицией кнопка — «Вернуться к моему местоположению»", locate.count() == 1)
    lb = rect(locate)
    check("кнопка геопозиции: ≥ 44 px, у правого края, над лентой (зона большого пальца)", lb["width"] >= 44 and lb["height"] >= 44 and lb["x"] + lb["width"] > vp["width"] - 30 and lb["y"] + lb["height"] < rect(RAIL(page))["y"], lb)
    top_btn = rect(page.get_by_role("button", name="Показать списком"))
    check("кнопка «список» в шапке ≥ 44 px", top_btn["width"] >= 44 and top_btn["height"] >= 44, top_btn)
    attr = page.locator(".apetite-map-fill .leaflet-control-attribution")
    ab = rect(attr)
    check("атрибуция OpenStreetMap видна и не закрыта ни лентой, ни кнопкой геопозиции", attr.count() == 1 and attr.is_visible() and ab and not intersects(ab, lb) and all(not intersects(ab, rect(c)) for c in rail_cards(page).all()), ab)
    check("атрибуция содержит «OpenStreetMap»", "OpenStreetMap" in attr.inner_text())
    check("точка «я здесь» нарисована", page.locator(".apetite-me").count() == 1)
    small = min(rect(c)["height"] for c in rail_cards(page).all())
    check("цели касания: все карточки ≥ 44 px высотой", small >= 44, small)
    ids = page.evaluate("(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id); return ids.length-new Set(ids).size})()")
    check("в документе нет дублирующихся id", ids == 0, ids)
    check("нет JS-ошибок на карте", not errs, errs[:2]); ctx.close()

    # ---------- без геопозиции ----------
    ctx, page, st, errs = new_page(b, geo=False); open_map(page)
    check("без геопозиции кнопка — «Определить моё местоположение», без точки «я здесь»", page.get_by_role("button", name="Определить моё местоположение").count() == 1 and page.locator(".apetite-me").count() == 0)
    check("без геопозиции порядок другой — горящие первыми, внутри по размеру скидки (а не по расстоянию)", titles(page)[:3] == [T[0], T[1], T[4]] and titles(page)[:3] != EXPECTED_ORDER[:3], titles(page))
    ctx.close()

    # ---------- пустое состояние ----------
    ctx, page, st, errs = new_page(b, empty=True); open_map(page)
    check("пусто: карта остаётся, внизу спокойное объяснение, ленты нет", page.get_by_text("На карте пока нет предложений").count() == 1 and RAIL(page).count() == 0 and page.locator(".apetite-map-fill").count() == 1)
    check("пусто: счётчик «Предложений: 0»", page.get_by_text("Предложений: 0").count() == 1)
    page.screenshot(path=os.path.join(OUT, "map_390_empty.png")); ctx.close()

    # ---------- раскладка ----------
    for name, vpz in (("320×568", {"width": 320, "height": 568}), ("375×667", {"width": 375, "height": 667}), ("402×874", {"width": 402, "height": 874}), ("768×1024", {"width": 768, "height": 1024}), ("1280×800", {"width": 1280, "height": 800})):
        ctx, page, st, errs = new_page(b, vpz); open_map(page)
        over = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
        c0 = rect(card(page, T[0])); c1 = rect(card(page, T[1]))
        rb = rect(RAIL(page)); tb = rect(page.get_by_role("heading", name="Карта"))
        fits = c0 and c0["x"] >= 0 and c0["x"] + c0["width"] <= vpz["width"] and rb["y"] + rb["height"] <= vpz["height"] + 1
        wide = vpz["width"] >= 768
        peek = wide or (c1 and c1["x"] < vpz["width"])
        check(f"{name}: нет прокрутки вбок, лента внутри экрана, карточка в пределах 264–344 px, следующая выглядывает", not over and fits and peek and 263 <= c0["width"] <= 345, (over, c0, c1))
        sel_mk = rect(marker(page, "Шаурма")); cy = sel_mk["y"] + sel_mk["height"] / 2 if sel_mk else -1
        check(f"{name}: пин первой карточки на карте и не под лентой/шапкой", sel_mk and tb["y"] + tb["height"] - 4 <= cy <= rb["y"] + 8, (cy, rb, tb))
        if name in ("320×568", "768×1024", "1280×800"): page.screenshot(path=os.path.join(OUT, f"map_{name.replace('×', 'x')}.png"))
        ctx.close()

    # ---------- тёмная тема, reduce-motion, доступность ----------
    ctx, page, st, errs = new_page(b, scheme="dark"); open_map(page)
    check("тёмная тема: карта в тёмной подложке (приглушённые тайлы)", page.locator(".apetite-map-fill.apetite-map-dark").count() == 1)
    page.screenshot(path=os.path.join(OUT, "map_390_dark.png")); ctx.close()

    ctx, page, st, errs = new_page(b, reduced=True); open_map(page)
    card(page, T[2]).click(); page.wait_for_timeout(900)
    check("reduce-motion: выбор по-прежнему работает, без плавных перелётов лента встаёт на место", current(page) == [T[2]] and rect(card(page, T[2]))["x"] < 60, current(page))
    check("reduce-motion: нет JS-ошибок", not errs, errs[:2]); ctx.close()

    try:
        from axe_playwright_python.sync_playwright import Axe
        axe = Axe(); tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
        def axe_violations(page): return [(v["id"], [n["target"] for n in v["nodes"]][:2]) for v in axe.run(page, options={"runOnly": {"type": "tag", "values": tags}}).response["violations"]]
        for scheme in ("light", "dark"):
            ctx, page, st, errs = new_page(b, scheme=scheme, reduced=True); open_map(page)
            bad = axe_violations(page)
            page.get_by_role("button", name="Показать списком").click(); page.wait_for_timeout(700); bad += axe_violations(page)
            check(f"axe ({scheme}): карта с лентой и список — 0 нарушений WCAG AA", not bad, bad); ctx.close()
    except ImportError:
        print("[SKIP] axe-playwright-python не установлен — a11y-аудит пропущен")

    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
