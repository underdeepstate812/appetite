"""QA экрана оффера мобильного web-приложения на ЗАМОКАННОМ API (фото, заведение, окно, остаток, панель покупки, a11y).
Сеть и пароли не нужны. Запуск: python3 qa/qa_mobile_offer.py (нужен mobile-web на :8081)."""
import json, os, re, sys, tempfile
from playwright.sync_api import sync_playwright

QA = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(QA, "qa_mobile.py")).read().split("with sync_playwright() as p:")[0])  # make_state, new_page, cards, check, iso, BASE …
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())
JPG_PATH = os.path.join(QA, "..", "apps", "backend", "assets", "offer-presets", "shawarma.jpg")
TITLE = "Шаурма классическая с говядиной"

def open_offer(b, vp, scheme="light", photo=True, business="ok", **offer_over):
    st = make_state(); o = st["offers"][1]
    o.update({"title": TITLE, "description": "Сочная говядина и свежие овощи — делаем при вас.", "imageUrl": "/uploads/offers/shawarma.jpg" if photo else None,
              "quantityLeft": 8, "quantityTotal": 10, "businessId": "biz-1", "discountPercent": 60, "originalPrice": 32000, "discountedPrice": 12800, **offer_over})
    ctx, page, st, errs = new_page(b, vp, scheme=scheme, state=st)
    def biz(route, request):
        h = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"}
        if request.method == "OPTIONS": return route.fulfill(status=204, headers=h)
        if business == "fail": return route.fulfill(status=500, content_type="application/json", body='{"statusCode":500,"message":"x"}', headers=h)
        route.fulfill(status=200, content_type="application/json", headers=h, body=json.dumps({"id": "biz-1", "name": "Shava Point", "address": "Невский проспект, 40, Санкт-Петербург", "lat": 59.93, "lng": 30.36, "category": "FOOD", "status": "ACTIVE"}))
    ctx.route("**/api/v1/businesses/**", biz)
    if photo:
        ctx.unroute("**/uploads/**")
        ctx.route("**/uploads/**", lambda route, request: route.fulfill(status=200, content_type="image/jpeg", body=open(JPG_PATH, "rb").read(), headers={"access-control-allow-origin": "*"}))
    page.reload(wait_until="networkidle"); page.wait_for_timeout(1200)  # браузер мог закэшировать подменённый ответ
    if "pickupStart" in offer_over:  # окно ещё не открыто — оффер лежит во вкладке «Вечерние»
        page.get_by_text("Вечерние", exact=True).click(); page.wait_for_timeout(900)
    cards(page).filter(has_text=TITLE).first.click(); page.wait_for_timeout(1500)
    return ctx, page, st, errs

def overflow(page): return page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    PH = {"width": 390, "height": 844}

    ctx, page, st, errs = open_offer(b, PH)
    T = page.inner_text("body")
    check("оффер: название, описание, заведение и категория", all(x in T for x in [TITLE, "Сочная говядина", "Shava Point", "Еда"]))
    check("оффер: цена, старая цена и экономия", "128 ₽" in T and "320 ₽" in T and "Экономия 192" in T, T[:200])
    check("оффер: блоки «время на самовывоз», «остаток», «где забирать», «как это работает»", all(x in T.upper() for x in ["ВРЕМЯ НА САМОВЫВОЗ", "ОСТАТОК", "ГДЕ ЗАБИРАТЬ", "КАК ЭТО РАБОТАЕТ"]))
    check("оффер: окно самовывоза записано диапазоном, остаток «8 из 10»", re.search(r"Забрать: \d{2}:\d{2}(?:–| — завтра )\d{2}:\d{2}", T) and "8 из 10" in T, T)
    check("оффер: адрес заведения показан", "Невский проспект, 40" in T)
    check("оффер: правило «после оплаты отменить нельзя» видно заранее", "После оплаты заказ отменить нельзя" in T)
    check("оффер: фото загрузилось (не заглушка и не битая картинка)", page.evaluate("() => [...document.images].some(i => i.src.includes('shawarma') && i.naturalWidth > 100)"))
    check("оффер: нет горизонтальной прокрутки", not overflow(page))
    buy = page.get_by_role("button", name="Купить")
    box = buy.bounding_box()
    check("оффер: кнопка «Купить» закреплена внизу экрана (в зоне большого пальца) и ≥ 48 px", box and box["y"] + box["height"] > PH["height"] - 40 and box["height"] >= 48, box)
    check("оффер: «Назад» подписан", page.get_by_role("button", name="Назад").count() == 1)
    page.screenshot(path=os.path.join(OUT, "offer_mobile.png"))
    # маршрут
    page.evaluate("window.__opened = null; window.open = (u) => { window.__opened = u; return null }")
    page.get_by_role("button", name="Маршрут").click(); page.wait_for_timeout(300)
    opened = page.evaluate("window.__opened")
    check("«Маршрут» открывает карту с координатами заведения", opened and "59.93" in opened and "30.36" in opened, opened)
    buy.click(); page.wait_for_timeout(1200)
    check("«Купить» ведёт на оформление этого оффера", "Оформление заказа" in page.inner_text("body"))
    ctx.close()

    # состояния
    ctx, page, st, errs = open_offer(b, PH, quantityLeft=0)
    check("раскуплено: кнопка заблокирована и так подписана", page.get_by_role("button", name="Раскупили").is_disabled()); ctx.close()
    ctx, page, st, errs = open_offer(b, PH, quantityLeft=2)
    check("почти раскуплено: предупреждение", "Почти раскупили" in page.inner_text("body")); ctx.close()
    ctx, page, st, errs = open_offer(b, PH, pickupEnd=iso(-30))
    T = page.inner_text("body")
    check("окно закрыто: так и сказано, «Купить» заблокирована", "Окно самовывоза закрыто" in T and page.get_by_role("button", name="Время вышло").is_disabled()); ctx.close()
    ctx, page, st, errs = open_offer(b, PH, pickupStart=iso(120), pickupEnd=iso(300))
    check("окно ещё не открылось: «Откроется в …»", re.search(r"Откроется в \d{2}:\d{2}", page.inner_text("body")) is not None); ctx.close()
    ctx, page, st, errs = open_offer(b, PH, featured=True, pickupEnd=iso(24 * 60 - 30))
    check("предложение дня: бейдж и окно через полночь с «завтра»", "Предложение дня" in page.inner_text("body") and "завтра" in page.inner_text("body")); ctx.close()
    ctx, page, st, errs = open_offer(b, PH, photo=False)
    check("без фото: фирменная картинка вместо пустоты, страница цела", not overflow(page) and TITLE in page.inner_text("body")); page.screenshot(path=os.path.join(OUT, "offer_nophoto.png")); ctx.close()
    ctx, page, st, errs = open_offer(b, PH, business="fail")
    check("заведение не загрузилось: покупка всё равно доступна, адрес — понятное сообщение", "Адрес недоступен" in page.inner_text("body") and page.get_by_role("button", name="Купить").is_enabled()); ctx.close()

    # размеры и темы
    for scheme in ("light", "dark"):
        for name, vp in (("320×568", {"width": 320, "height": 568}), ("390×844", PH), ("планшет/веб 1000×920", {"width": 1000, "height": 920})):
            ctx, page, st, errs = open_offer(b, vp, scheme)
            bar = page.get_by_role("button", name="Купить").bounding_box()
            check(f"{scheme} / {name}: без горизонтальной прокрутки, «Купить» в пределах экрана", not overflow(page) and bar and 0 <= bar["x"] and bar["x"] + bar["width"] <= vp["width"] and bar["y"] + bar["height"] <= vp["height"] + 1, bar)
            if "1000" in name:
                hero = page.evaluate("() => { const i=[...document.images].find(x=>x.src.includes('shawarma')); const r=i.getBoundingClientRect(); return [r.width, r.left] }")
                check(f"{scheme} / широкий экран: колонка не растягивается (фото ≤ 560 px)", hero[0] <= 560, hero)
                page.screenshot(path=os.path.join(OUT, f"offer_wide_{scheme}.png"))
            ctx.close()
    # доступность
    try:
        from axe_playwright_python.sync_playwright import Axe
        axe = Axe(); tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
        for scheme in ("light", "dark"):
            ctx, page, st, errs = open_offer(b, PH, scheme)
            bad = [v["id"] for v in axe.run(page, options={"runOnly": {"type": "tag", "values": tags}}).response["violations"]]
            check(f"axe ({scheme}): экран оффера — 0 нарушений WCAG AA", not bad, bad); ctx.close()
    except ImportError:
        print("[SKIP] axe-playwright-python не установлен — a11y-аудит пропущен")
    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
