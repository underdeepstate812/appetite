"""QA автоподсказок адреса и выбора точки на карте в онбординге заведения (admin).

Подсказки идут в НАСТОЯЩИЙ Nominatim (нужен интернет), всё остальное — замоканный API с
фейковыми токенами: пароли и backend не нужны. Между реальными запросами пауза >1с —
публичный Nominatim ограничивает частоту (1 req/s)."""
import json, re, sys, time
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:5173"
NOMINATIM = "nominatim.openstreetmap.org/search"
SPB = (59.8, 60.1, 30.1, 30.6)  # lat_min, lat_max, lng_min, lng_max
DEFAULT_POINT = (59.9311, 30.3609)
results = []
now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))


def open_modal(browser, viewport, captured):
    ctx = browser.new_context(viewport=viewport, locale="ru-RU")
    ctx.add_init_script("localStorage.setItem('apetite.admin.accessToken','fake.a'); localStorage.setItem('apetite.admin.refreshToken','fake.r');")

    def handler(route, request):
        path = re.sub(r"^https?://[^/]+/api/v1", "", request.url).split("?")[0]
        cors = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"}
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)

        def ok(data, status=200):
            route.fulfill(status=status, content_type="application/json", body=json.dumps(data), headers=cors)

        if path == "/auth/me":
            return ok({"id": "ua", "email": "admin@example.test", "name": "Админ", "role": "ADMIN", "notifyRadiusKm": 5, "createdAt": now, "updatedAt": now})
        if path == "/platform/businesses":
            return ok([])
        if path == "/platform/settings":
            return ok({"trialPeriodDays": 25})
        if path == "/businesses" and request.method == "POST":
            captured.append(json.loads(request.post_data or "{}"))
            return ok({"id": "new-biz"}, 201)
        return ok({"statusCode": 404, "message": f"unmocked {request.method} {path}"}, 404)

    ctx.route("**/api/v1/**", handler)
    page = ctx.new_page()
    errors, nominatim_requests = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: nominatim_requests.append(r.url) if NOMINATIM in r.url else None)
    page.goto(BASE + "/platform/businesses", wait_until="networkidle")
    page.get_by_role("button", name="+ Онбординг заведения").click()
    expect(page.locator("#address")).to_be_visible()
    return ctx, page, errors, nominatim_requests


def suggestions(page):
    return page.locator("#address").locator("xpath=../..").locator("ul button")


def coords_text(page):
    return page.locator("p[style*='tabular-nums']").inner_text()


def parse(text):
    lat, lng = (float(x) for x in text.split(","))
    return lat, lng


with sync_playwright() as p:
    b = p.chromium.launch()
    captured = []
    ctx, page, errors, reqs = open_modal(b, {"width": 1280, "height": 900}, captured)

    # ── структура формы ──
    check("в форме нет ручных полей широты/долготы", page.get_by_label("Широта").count() == 0 and page.get_by_label("Долгота").count() == 0)
    check("рядом с адресом есть кнопка карты", page.get_by_role("button", name="Уточнить точку на карте").is_visible())

    # ── порог длины: <3 символов — запроса нет ──
    page.locator("#address").fill("Не")
    page.wait_for_timeout(900)
    check("<3 символов: запрос в Nominatim не уходит", len(reqs) == 0, f"запросов: {len(reqs)}")
    check("<3 символов: выпадашки нет", suggestions(page).count() == 0)

    # ── дебаунс: быстрый набор = один запрос ──
    page.locator("#address").fill("")
    page.locator("#address").press_sequentially("Невский проспект 28", delay=40)
    page.wait_for_timeout(2500)
    check("быстрый набор даёт ровно 1 запрос (дебаунс)", len(reqs) == 1, f"запросов: {len(reqs)}")
    first_url = reqs[0] if reqs else ""
    check("запрос ограничен Россией и смещён к Петербургу", "countrycodes=ru" in first_url and "viewbox=" in first_url, first_url[-120:])

    # ── реальные подсказки ──
    n = suggestions(page).count()
    check("пришли подсказки адреса (>=1)", n >= 1, f"подсказок: {n}")
    texts = [suggestions(page).nth(i).inner_text() for i in range(n)]
    check("в подсказках есть Санкт-Петербург", any(re.search("Санкт-Петербург|Saint Petersburg", t) for t in texts), str(texts[:2]))

    # ── выбор подсказки ──
    chosen = texts[0] if texts else ""
    if n:
        suggestions(page).first.click()
        check("выбор подсказки подставляет адрес в поле", page.locator("#address").input_value() == chosen)
        check("после выбора выпадашка закрыта", suggestions(page).count() == 0)
        page.wait_for_timeout(1300)
        check("выбор подсказки не запускает новый поиск", len(reqs) == 1, f"запросов: {len(reqs)}")

    # ── карта: точка из геокодера ──
    page.get_by_role("button", name="Уточнить точку на карте").click()
    expect(page.locator(".leaflet-container")).to_be_visible(timeout=6000)
    page.wait_for_timeout(1200)
    lat0, lng0 = parse(coords_text(page))
    check("карта открыта на точке из подсказки, а не на центре по умолчанию", (round(lat0, 4), round(lng0, 4)) != DEFAULT_POINT, f"{lat0},{lng0}")
    check("точка внутри Петербурга", SPB[0] < lat0 < SPB[1] and SPB[2] < lng0 < SPB[3], f"{lat0},{lng0}")
    check("тайлы карты подгрузились", page.locator(".leaflet-tile-loaded").count() > 0)

    # ── клик по карте двигает точку ──
    box = page.locator(".leaflet-container").bounding_box()
    page.mouse.click(box["x"] + 60, box["y"] + 60)
    page.wait_for_timeout(400)
    lat1, lng1 = parse(coords_text(page))
    check("клик по карте меняет координаты", (lat1, lng1) != (lat0, lng0), f"{lat0},{lng0} -> {lat1},{lng1}")
    page.get_by_role("button", name="Подтвердить точку").click()
    check("после подтверждения карта закрыта", page.locator(".leaflet-container").count() == 0)
    check("подтверждение точки не стирает адрес", page.locator("#address").input_value() == chosen)

    # ── отправка: в API уходят выбранные адрес и координаты ──
    page.locator("#name").fill("Тестовое кафе адреса")
    page.locator("#ownerName").fill("Иван Тестов")
    page.locator("#ownerEmail").fill("address-qa@example.test")
    page.locator("#ownerPassword").fill("TestPass123!")
    page.get_by_role("button", name="Создать заведение").click()
    page.wait_for_timeout(900)
    body = captured[0] if captured else {}
    check("POST /businesses ушёл", len(captured) == 1)
    check("в запросе адрес из подсказки", body.get("address") == chosen, str(body.get("address"))[:80])
    check("в запросе координаты с карты (а не из геокодера)", abs(body.get("lat", 0) - lat1) < 1e-6 and abs(body.get("lng", 0) - lng1) < 1e-6, f"{body.get('lat')},{body.get('lng')} vs {lat1},{lng1}")
    check("в запросе нет мусора вместо чисел", isinstance(body.get("lat"), float) and isinstance(body.get("lng"), float))
    check("нет необработанных JS-ошибок", not errors, str(errors[:2]))
    ctx.close()

    # ── пустая выдача и закрытие по клику вне ──
    time.sleep(1.3)  # страница уже закрыта, а Nominatim просит паузу между запросами
    ctx, page, errors, reqs = open_modal(b, {"width": 1280, "height": 900}, [])
    page.locator("#address").fill("ъъъъъъъъъъъъъ")
    page.wait_for_timeout(2500)
    check("бессмысленный запрос: выпадашки нет, ошибок нет", suggestions(page).count() == 0 and not errors, str(errors[:1]))
    page.wait_for_timeout(1300)
    page.locator("#address").fill("Невский проспект 1")
    page.wait_for_timeout(2500)
    had = suggestions(page).count()
    page.locator("#name").click()
    page.wait_for_timeout(300)
    check("клик вне поля закрывает выпадашку", had >= 1 and suggestions(page).count() == 0, f"было {had}")
    ctx.close()

    # ── сбой сети геокодера ──
    ctx, page, errors, reqs = open_modal(b, {"width": 1280, "height": 900}, [])
    ctx.route(re.compile(r".*nominatim\.openstreetmap\.org.*"), lambda route, request: route.abort("connectionrefused"))
    page.locator("#address").fill("Невский проспект 28")
    page.wait_for_timeout(1800)
    check("геокодер недоступен: страница жива, выпадашки нет", suggestions(page).count() == 0 and not errors, str(errors[:1]))
    page.locator("#address").fill("Невский проспект 28, 2")
    check("после сбоя поле по-прежнему редактируемо", page.locator("#address").input_value().endswith(", 2"))
    ctx.close()

    # ── мобильная вёрстка карты ──
    page_ctx_vp = {"width": 390, "height": 844}
    ctx, page, errors, reqs = open_modal(b, page_ctx_vp, [])
    page.get_by_role("button", name="Уточнить точку на карте").click()
    expect(page.locator(".leaflet-container")).to_be_visible(timeout=6000)
    page.wait_for_timeout(800)
    box = page.locator(".leaflet-container").bounding_box()
    check("мобильный: карта целиком в ширине экрана", box and box["x"] >= 0 and box["x"] + box["width"] <= 390 + 1, str(box))
    check("мобильный: нет горизонтального скролла", page.evaluate("document.documentElement.scrollWidth") <= 391)
    confirm = page.get_by_role("button", name="Подтвердить точку")
    cbox = confirm.bounding_box()
    check("мобильный: «Подтвердить точку» достижима (в пределах экрана или по скроллу модалки)", cbox is not None)
    ctx.close()
    b.close()

print(f"\n{sum(results)}/{len(results)} проверок прошли")
sys.exit(0 if all(results) else 1)
