"""QA бегущей ленты предложений над картой на вкладке «Сейчас» мобильного web-приложения на ЗАМОКАННОМ API: сеть и пароли не нужны.
Лента едет сама без шва, замирает под пальцем/указателем/фокусом, открывает предложение по нажатию, стоит, когда вкладка не на виду,
при reduce-motion — обычная прокрутка; раскладка, доступность (aria-hidden у копий петли, Tab), axe.
Запуск: python3 qa/qa_mobile_ribbon.py (нужен mobile-web на :8081). Скриншоты — в QA_OUT."""
import json, os, re, sys, tempfile
from playwright.sync_api import sync_playwright

QA = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(QA, "qa_mobile_orders.py")).read().split("\nwith sync_playwright() as p:")[0])  # make_state, new_page, tab, check, iso …
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())

TRACK = "[data-testid=offer-ribbon-track]"
RIBBON = "[data-testid=offer-ribbon]"
def tx(page):
    """Текущий сдвиг ленты по X (px): из matrix(a, b, c, d, tx, ty) вычисленного transform."""
    return page.evaluate("(sel) => { const e = document.querySelector(sel); if (!e) return null; const m = getComputedStyle(e).transform; return m === 'none' ? 0 : +m.split(',')[4] }", TRACK)
def speed(page, ms=2000):
    a = tx(page); page.wait_for_timeout(ms); b = tx(page)
    return None if a is None or b is None else round((a - b) / (ms / 1000), 1)
def ribbon_cards(page):
    """Настоящие (не скрытые от скринридера) карточки ленты."""
    return page.locator(f"{RIBBON} [role=button]:not([aria-hidden=true])")
def y_of(page, sel):
    box = page.locator(sel).first.bounding_box()
    return box["y"] if box else None

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ---------- состав и расположение ----------
    ctx, page, st, errs = new_page(b, PH); page.wait_for_timeout(1500)
    check("лента на месте: группа с подписью, заголовок «Сейчас на витрине» и число предложений", page.locator(RIBBON).count() == 1 and page.get_by_text("Сейчас на витрине").count() == 1 and page.get_by_role("group", name=re.compile("Лента предложений")).count() == 1)
    greeting_y = y_of(page, "text=Привет, Тест"); ribbon_y = y_of(page, RIBBON); map_y = y_of(page, ".apetite-map-fill, .leaflet-container")
    list_y = page.get_by_role("button", name=re.compile("Набор десертов дня")).last.bounding_box()["y"]
    check("порядок на экране: приветствие → лента → карта → список", greeting_y < ribbon_y < map_y < list_y, (greeting_y, ribbon_y, map_y, list_y))
    count = page.locator(RIBBON).locator("xpath=preceding-sibling::*[1]").inner_text()
    check("число в заголовке = число открытых предложений (5: закрытое и «не начавшееся» не едут)", re.search(r"\b5\b", count) is not None and ribbon_cards(page).count() == 5, (count, ribbon_cards(page).count()))
    names = [c.get_attribute("aria-label") for c in ribbon_cards(page).all()]
    check("у каждой карточки подпись: название, заведение, цена, скидка, время и «Открыть предложение»", all(re.search(r"₽, скидка \d+%", n) and n.endswith("Открыть предложение") for n in names), names[:1])
    copies = page.locator(f"{RIBBON} [role=button][aria-hidden=true]")
    tabbable = page.evaluate("(sel) => document.querySelectorAll(sel + ' [aria-hidden=true] [tabindex=\"0\"], ' + sel + ' [aria-hidden=true][tabindex=\"0\"]').length", RIBBON)
    check("копии петли скрыты от скринридера (aria-hidden) и выпали из порядка Tab", copies.count() >= 5 and all(c.get_attribute("tabindex") in (None, "-1") for c in copies.all()) and tabbable == 0, (copies.count(), tabbable))
    edge = page.evaluate("(sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left, r.right, innerWidth] }", RIBBON)
    check("лента выходит к краям экрана (без полей), как «проезжающая»", edge[0] <= 1 and edge[1] >= edge[2] - 1, edge)
    page.screenshot(path=os.path.join(OUT, "ribbon_390.png"))

    # ---------- движение ----------
    v = speed(page, 2500)
    check("лента едет справа налево со скоростью ≈ 34 px/с (28…40)", v is not None and 28 <= v <= 40, v)
    first, fifth_copy = page.locator(f"{RIBBON} [role=button]").nth(0).bounding_box(), page.locator(f"{RIBBON} [role=button]").nth(5).bounding_box()
    check("петля бесшовная: копия набора лежит ровно через длину набора (5 × 258 px)", abs((fifth_copy["x"] - first["x"]) - 5 * 258) < 3, (first["x"], fifth_copy["x"]))
    track_w = page.evaluate("(sel) => document.querySelector(sel).getBoundingClientRect().width", TRACK)
    check("дорожка длиннее экрана + петли: справа никогда не пусто", track_w >= 390 + 5 * 258, track_w)

    # ---------- замирает ----------
    card = ribbon_cards(page).nth(1); box = card.bounding_box()
    page.mouse.move(max(box["x"], 40) + 30, box["y"] + box["height"] / 2); page.wait_for_timeout(600)
    still = speed(page, 1500)
    check("под указателем лента замирает", still == 0, still)
    at_hover = tx(page)
    page.mouse.move(200, 20); page.wait_for_timeout(800)
    after = tx(page); moved = speed(page, 1500)
    check("уберёшь указатель — едет дальше с того же места (не рывком с нуля)", moved and moved > 20 and after <= at_hover + 1 and after > at_hover - 120, (at_hover, after, moved))
    page.mouse.move(box["x"] + 60 if box["x"] > 0 else 80, box["y"] + 30); page.mouse.down(); page.wait_for_timeout(500)
    held = speed(page, 1500)
    page.mouse.move(200, 20); page.mouse.up(); page.wait_for_timeout(500)  # палец ушёл с карточки до отпускания: это не нажатие, предложение не открывается
    check("пока карточку держат пальцем, лента стоит", held == 0, held)
    check("отпустили — лента снова едет (не залипла)", (speed(page, 1500) or 0) > 20)
    page.evaluate("document.activeElement && document.activeElement.blur()")
    page.keyboard.press("Tab")
    focused_in = page.evaluate("(sel) => !!document.activeElement && !!document.activeElement.closest(sel)", RIBBON)
    for _ in range(12):
        if focused_in: break
        page.keyboard.press("Tab"); focused_in = page.evaluate("(sel) => !!document.activeElement && !!document.activeElement.closest(sel)", RIBBON)
    page.wait_for_timeout(500)
    check("с клавиатуры: Tab доходит до карточки ленты, и пока она в фокусе, лента стоит", focused_in and speed(page, 1200) == 0, focused_in)
    page.keyboard.press("Enter"); page.get_by_role("button", name="Купить").wait_for(timeout=15000)
    check("Enter на карточке в фокусе открывает предложение", page.get_by_role("button", name="Купить").count() == 1)
    page.get_by_role("button", name="Назад").click(); page.wait_for_timeout(1000)
    page.evaluate("document.activeElement && document.activeElement.blur()"); page.mouse.move(200, 20); page.wait_for_timeout(800)
    check("вернулись назад — лента снова едет", (speed(page, 1500) or 0) > 20)

    # ---------- нажатие ----------
    # Как человек: берём карточку, которая сейчас целиком на экране, подводим указатель (лента замирает) и нажимаем.
    visible = None
    for c in ribbon_cards(page).all():
        bb = c.bounding_box()
        if bb and bb["x"] >= 8 and bb["x"] + bb["width"] <= 382: visible = (c, bb); break
    if visible is None:  # вдруг в кадре только куски — ждём, пока одна карточка проедет целиком
        for _ in range(40):
            page.wait_for_timeout(250)
            for c in ribbon_cards(page).all():
                bb = c.bounding_box()
                if bb and bb["x"] >= 8 and bb["x"] + bb["width"] <= 382: visible = (c, bb); break
            if visible: break
    card, bb = visible; title = card.get_attribute("aria-label").split(",")[0]
    page.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); page.wait_for_timeout(250)
    page.mouse.down(); page.mouse.up(); page.get_by_role("button", name="Купить").wait_for(timeout=15000)
    check("нажатие по карточке на ходу открывает именно это предложение", page.get_by_text(title).count() >= 1 and page.get_by_role("button", name="Купить").count() == 1, title)
    page.get_by_role("button", name="Назад").click(); page.wait_for_timeout(1000)

    # ---------- вкладка не на виду ----------
    tab(page, "Заказы"); page.wait_for_timeout(600)
    away = speed(page, 1500)
    check("пока открыта другая вкладка, лента не едет (нет работы вхолостую)", away == 0, away)
    tab(page, "Сейчас"); page.mouse.move(200, 20); page.wait_for_timeout(600)
    check("вернулись на «Сейчас» — лента поехала снова", (speed(page, 1500) or 0) > 20)
    check("нет JS-ошибок", not errs, errs[:2]); ctx.close()

    # ---------- reduce-motion и мало предложений ----------
    ctx = b.new_context(viewport=PH, color_scheme="dark", reduced_motion="reduce", geolocation={"latitude": 59.9311, "longitude": 30.3609}, permissions=["geolocation"], locale="ru-RU")
    st = make_state(); ctx.add_init_script("localStorage.setItem('apetite.accessToken','fake.a.b'); localStorage.setItem('apetite.refreshToken','fake.r.b');"); install_api(ctx, st)
    page = ctx.new_page(); errs = []; page.goto(BASE, wait_until="networkidle"); page.wait_for_timeout(1800)
    check("reduce-motion: бегущей дорожки нет, лента — обычная прокрутка пальцем", page.locator(TRACK).count() == 0 and page.locator(RIBBON).count() == 1)
    scroller = page.evaluate("(sel) => { const r = document.querySelector(sel); return !![...r.querySelectorAll('*')].find(e => e.scrollWidth > e.clientWidth + 10 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowX)) }", RIBBON)
    check("reduce-motion: все пять предложений доступны горизонтальной прокруткой", scroller and ribbon_cards(page).count() == 5, (scroller, ribbon_cards(page).count()))
    ctx.close()

    s2 = make_state(); s2["offers"] = s2["offers"][:2]
    ctx, page, s2, errs = new_page(b, PH, state=s2); page.wait_for_timeout(1500)
    check("всего два предложения: лента не бежит (одна и та же карточка дважды в кадре — глупо), но показана", page.locator(TRACK).count() == 0 and ribbon_cards(page).count() == 2, (page.locator(TRACK).count(), ribbon_cards(page).count()))
    ctx.close()
    s3 = make_state(); s3["mode"]["empty"] = True
    ctx, page, s3, errs = new_page(b, PH, state=s3); page.wait_for_timeout(1500)
    check("нет предложений: ленты нет вовсе, а не пустая рамка", page.locator(RIBBON).count() == 0)
    ctx.close()

    # ---------- раскладка ----------
    for name, vp in (("320×568", {"width": 320, "height": 568}), ("390×844", {"width": 390, "height": 844}), ("768×1024", {"width": 768, "height": 1024}), ("1280×800", {"width": 1280, "height": 800})):
        ctx, page, st, errs = new_page(b, vp); page.wait_for_timeout(1500)
        over = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
        h = page.locator(RIBBON).bounding_box()["height"]
        tw = page.evaluate("(sel) => document.querySelector(sel).getBoundingClientRect().width", TRACK)
        check(f"{name}: нет прокрутки вбок, лента ≈ 98 px высотой, справа не пусто (дорожка ≥ экран + петля)", not over and 90 <= h <= 130 and tw >= vp["width"] + 5 * 258, (over, h, tw))
        if name in ("320×568", "1280×800"): page.screenshot(path=os.path.join(OUT, f"ribbon_{name.replace('×', 'x')}.png"))
        ctx.close()

    # ---------- доступность ----------
    try:
        from axe_playwright_python.sync_playwright import Axe
        axe = Axe(); tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
        for scheme in ("dark", "light"):
            ctx, page, st, errs = new_page(b, PH, scheme); page.wait_for_timeout(1500)
            bad = [(v["id"], [n["target"] for n in v["nodes"]][:2]) for v in axe.run(page, options={"runOnly": {"type": "tag", "values": tags}}).response["violations"]]
            check(f"axe ({scheme}): «Сейчас» с лентой — 0 нарушений WCAG AA", not bad, bad); ctx.close()
    except ImportError:
        print("[SKIP] axe-playwright-python не установлен — a11y-аудит пропущен")

    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
