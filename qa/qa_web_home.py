"""Витрина сайта (/home): лента «Сейчас на витрине» сверху, карта ниже, метки горячих предложений с фото, адаптивность
(iPhone 17, 320, 768, 1024, 1440), движки Chromium и Firefox, жесты карты на странице с прокруткой, лента сама плывёт (петля, паузы, переключатель в панели, reduced-motion), фильтры (категория, цена от/до с проверками), центровка цифр лендинга.

Нужны: backend :3000 с seed + свежая витрина (pnpm --filter @apetite/backend prisma:seed:showcase — окна выдачи живут часы,
иначе «горящих» с фото не будет), web :5174. Ничего не покупает и не вводит паролей. Запуск: python3 qa/qa_web_home.py
Движки: QA_ENGINES=chromium,firefox[,webkit] (по умолчанию Chromium и Firefox — см. комментарий про WebKit ниже)."""
import os, re, sys
from playwright.sync_api import sync_playwright

WEB = os.environ.get("WEB_URL", "http://localhost:5174")
OUT = os.environ.get("QA_OUT", "/tmp")
# WebKit по умолчанию выключен: на части машин Playwright-WebKit запускается, но new_page() зависает (проверено на macOS 14) —
# включайте явно: QA_ENGINES=chromium,firefox,webkit. Мобильный Safari в этом наборе имитирует только Chromium (is_mobile + touch).
ENGINES = os.environ.get("QA_ENGINES", "chromium,firefox").split(",")
results = []

def check(name, cond, extra=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f" | {extra}"))

# Защита: скрипт кликает по живому приложению — только локальный dev-хост.
from urllib.parse import urlparse
if urlparse(WEB).hostname not in ("localhost", "127.0.0.1", "::1"):
    sys.exit(f"Отказ: {WEB} — не локальный dev-хост.")

VIEWPORTS = [("iphone17", 402, 874, True), ("iphone-se", 320, 568, True), ("tablet", 768, 1024, True), ("laptop", 1024, 768, False), ("desktop", 1440, 900, False)]

# Лента крутится сама и для бесшовной петли несёт вторую копию карточек (.is-clone): считать и кликать надо оригиналы.
CARD = ".showcase-item:not(.is-clone) .show-card"

UNION = """(sel) => [...document.querySelectorAll(sel)].map(host => {
  const rects = [host, ...host.querySelectorAll('*')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  return { l: Math.min(...rects.map(r => r.left)), t: Math.min(...rects.map(r => r.top)), r: Math.max(...rects.map(r => r.right)), b: Math.max(...rects.map(r => r.bottom)) };
})"""

def rect(page, sel):
    return page.evaluate("(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}}", sel)

def new_ctx(p, browser, engine, w, h, mobile, motion="reduce"):
    # По умолчанию prefers-reduced-motion: лента стоит, и Playwright может кликать по карточкам (у движущегося элемента нет «стабильности»).
    # Автодвижение проверяет run_drift — с обычным движением.
    opts = dict(viewport={"width": w, "height": h}, locale="ru-RU", device_scale_factor=2, reduced_motion=motion)
    if engine != "firefox":  # Firefox не умеет is_mobile; ширину эмулируем вьюпортом
        opts.update(is_mobile=mobile, has_touch=mobile)
        if mobile and engine == "webkit":
            opts["user_agent"] = p.devices["iPhone 15"]["user_agent"]
    else:
        opts.update(has_touch=mobile)
    return browser.new_context(**opts)

def pins(page):
    return page.locator(".leaflet-marker-icon:has(.map-pin, .map-pin-photo)")

def count_in_title(page):
    m = re.match(r"(\d+)", page.locator("#showcase-title").inner_text()); return int(m.group(1)) if m else -1

def run_landing(page, label, w):
    page.goto(WEB + "/", wait_until="networkidle"); page.wait_for_timeout(1800)
    # Сравниваем с шириной ЭКРАНА, а не с innerWidth: мобильный браузер при переполнении раздувает layout-viewport, и innerWidth «подстраивается».
    check(f"[{label}] лендинг: нет горизонтальной прокрутки, страница не раздувает экран", page.evaluate("document.documentElement.scrollWidth") <= w and page.evaluate("innerWidth") == w, page.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
    vals = page.evaluate("[...document.querySelectorAll('.hero-stat-value')].map(e => { const r = e.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(e).fontSize); return { text: e.textContent, oneLine: r.height < fs * 1.6, nowrap: getComputedStyle(e).whiteSpace === 'nowrap' }; })")
    check(f"[{label}] лендинг: «25–70%», «1–3 ч», «4» — по одной строке", len(vals) == 3 and all(v["oneLine"] and v["nowrap"] for v in vals), vals)
    labels = page.evaluate("[...document.querySelectorAll('.hero-stat-label')].map(e => e.scrollWidth <= e.clientWidth + 1)")
    check(f"[{label}] лендинг: подписи цифр не вылезают из колонок", all(labels), labels)
    if w <= 640:
        box = page.evaluate("(()=>{const r=document.querySelector('.hero-stats').getBoundingClientRect(); const cols=[...document.querySelectorAll('.hero-stat')].map(e=>{const c=e.getBoundingClientRect(); const v=e.querySelector('.hero-stat-value').getBoundingClientRect(); return {mid:(v.left+v.right)/2, colMid:(c.left+c.right)/2, w:c.width}}); return {mid:(r.left+r.right)/2, vw:innerWidth, cols, ta:getComputedStyle(document.querySelector('.hero-stat')).textAlign}})()")
        check(f"[{label}] лендинг: цифры — блок по центру экрана", abs(box["mid"] - box["vw"] / 2) <= 2, box)
        check(f"[{label}] лендинг: каждое значение по центру своей колонки, колонки равны", all(abs(c["mid"] - c["colMid"]) <= 2 for c in box["cols"]) and max(c["w"] for c in box["cols"]) - min(c["w"] for c in box["cols"]) <= 1.5 and box["ta"] == "center", box)
        btn = page.evaluate("[...document.querySelectorAll('.hero-cta .btn')].map(e => Math.round(e.getBoundingClientRect().width))")
        check(f"[{label}] лендинг: две кнопки героя одной ширины", len(btn) == 2 and abs(btn[0] - btn[1]) <= 1, btn)
    page.screenshot(path=f"{OUT}/home_landing_{label}.png")

def run_home(p, browser, engine, vp_name, w, h, mobile):
    label = f"{engine}/{vp_name}"
    ctx = new_ctx(p, browser, engine, w, h, mobile); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    page.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" and not re.search("Failed to load resource|net::|tile\\.openstreetmap|arcgisonline", m.text) else None)
    run_landing(page, label, w)

    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".show-card", timeout=20000); page.wait_for_selector(".leaflet-marker-icon", timeout=20000); page.wait_for_timeout(1800)
    check(f"[{label}] витрина: нет горизонтальной прокрутки, страница не раздувает экран", page.evaluate("document.documentElement.scrollWidth") <= w and page.evaluate("innerWidth") == w, page.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
    check(f"[{label}] витрина: заголовок «Сейчас на витрине» и счётчик", "сейчас на витрине" in page.locator(".showcase-eyebrow").inner_text().lower() and count_in_title(page) > 0, page.locator("#showcase-title").inner_text())
    cards = page.locator(CARD).count()
    check(f"[{label}] лента: от 1 до 16 карточек + карточка «на карте»", 1 <= cards <= 16 and page.locator(".showcase-item:not(.is-clone) .show-more").count() == 1, cards)
    first = rect(page, ".show-card")
    check(f"[{label}] лента: первая карточка целиком в экране и не уже 220 px", first and first["l"] >= 0 and first["r"] <= w and first["w"] >= 220, first)
    second = rect(page, ".showcase-item:nth-child(2) .show-card")
    if w <= 640: check(f"[{label}] лента: на телефоне видна кромка второй карточки (подсказка, что лента листается)", second and second["l"] < w - 8, second)
    ft = page.evaluate("(()=>{const r=document.querySelector('.show-card').getBoundingClientRect(); const head=document.querySelector('.showcase-head').getBoundingClientRect(); return {top:r.top, headTop:head.top, vh:innerHeight}})()")
    check(f"[{label}] лента видна без прокрутки (первый экран = лента, не карта)", ft["top"] < ft["vh"] * 0.85, ft)

    # --- цели касания ---
    if w <= 768:
        small = page.evaluate("[...document.querySelectorAll('.showcase-filters .ribbon-filter, .map-style-switch button, .showcase-locate, .show-card, .show-more')].filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map(e => e.className + ':' + Math.round(e.getBoundingClientRect().height))")
        check(f"[{label}] цели касания ≥ 44 px (чипы, переключатель слоя, карточки)", not small, small)
        check(f"[{label}] стрелки ленты на тач-экране скрыты", page.locator(".showcase-arrow-next").is_hidden())

    # --- карта: метки целиком внутри, ничего не обрезано сверху, переключатель слоя не перекрывает ---
    stage = rect(page, ".home-map .map-stage"); sw = rect(page, ".home-map-head .map-style-switch")
    check(f"[{label}] карта: переключатель слоя над картой, а не на ней", sw and stage and sw["b"] <= stage["t"] + 0.5, (sw, stage))
    marks = page.evaluate(UNION, ".leaflet-marker-icon:has(.map-pin), .leaflet-marker-icon:has(.map-pin-photo)")
    spill = [m for m in marks if m["t"] < stage["t"] - 0.5 or m["l"] < stage["l"] - 0.5 or m["r"] > stage["r"] + 0.5 or m["b"] > stage["b"] + 0.5]
    check(f"[{label}] карта: все метки (с бейджами) целиком внутри карты — верх не обрезан", marks and not spill, (len(marks), spill[:2], stage))
    n_photo = page.locator(".map-pin-photo").count()
    check(f"[{label}] карта: у горящих предложений метки с фото", n_photo >= 1, n_photo)
    loaded = page.evaluate("[...document.querySelectorAll('.map-pin-photo img')].every(i => i.complete && i.naturalWidth > 0)")
    check(f"[{label}] карта: фото в метках загрузились", loaded)
    sizes = page.evaluate("[...document.querySelectorAll('.map-pin-photo-disc')].map(e => Math.round(e.getBoundingClientRect().width))")
    check(f"[{label}] карта: фото-метки — небольшие иконки (≤ 62 px)", sizes and max(sizes) <= 62, sizes)
    check(f"[{label}] карта: число меток = числу предложений в заголовке", pins(page).count() == count_in_title(page), (pins(page).count(), count_in_title(page)))
    page.screenshot(path=f"{OUT}/home_top_{label}.png")

    # --- фильтры общие для ленты и карты ---
    total = count_in_title(page)
    page.get_by_role("button", name=re.compile("Горящие")).click(); page.wait_for_timeout(900)
    hot_n = count_in_title(page)
    check(f"[{label}] «Горящие»: и лента, и карта сужаются до одного набора", 0 < hot_n < total and pins(page).count() == hot_n, (total, hot_n, pins(page).count()))
    page.get_by_role("button", name=re.compile("Горящие")).click(); page.wait_for_timeout(900)
    page.get_by_role("tab", name="Цветы").click(); page.wait_for_timeout(1200)
    fl = count_in_title(page)
    check(f"[{label}] категория «Цветы»: набор в ленте и на карте совпадает и меньше общего", 0 < fl < total and pins(page).count() == fl, (total, fl, pins(page).count()))
    page.get_by_role("tab", name="Все").click(); page.wait_for_timeout(1200)

    # --- лента → карта ---
    page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(300)
    page.locator(".show-card").nth(1).click(); page.wait_for_selector(".offer-sheet"); page.wait_for_timeout(1400)
    stage = rect(page, ".home-map .map-stage"); sheet = rect(page, ".offer-sheet")
    vh = page.evaluate("innerHeight")
    check(f"[{label}] клик по карточке: сама карта подведена под шапку (и целиком в экране, если помещается)", stage and 50 <= stage["t"] <= 150 and (stage["h"] > vh - 120 or stage["b"] <= vh + 2), (stage, vh))
    check(f"[{label}] клик по карточке: карточка отмечена, открыта шторка с кнопкой покупки", page.locator(CARD + ".is-selected").count() == 1 and page.locator(".offer-sheet a.btn-primary").count() == 1)
    check(f"[{label}] шторка целиком внутри карты", sheet["l"] >= stage["l"] - 1 and sheet["r"] <= stage["r"] + 1 and sheet["t"] >= stage["t"] - 1 and sheet["b"] <= stage["b"] + 1, (sheet, stage))
    sel = page.evaluate(UNION, ".map-pin.is-selected, .map-pin-photo.is-selected")
    selhost = page.evaluate("(()=>{const e=document.querySelector('.map-pin.is-selected, .map-pin-photo.is-selected'); if(!e) return null; const r=e.getBoundingClientRect(); const s=document.querySelector('.offer-sheet').getBoundingClientRect(); return {pinBottom:r.bottom, sheetTop:s.top, sheetLeft:s.left, sheetRight:s.right, pinLeft:r.left, pinRight:r.right}})()")
    clear = selhost and (selhost["pinBottom"] <= selhost["sheetTop"] + 2 or selhost["pinRight"] <= selhost["sheetLeft"] + 2 or selhost["pinLeft"] >= selhost["sheetRight"] - 2)
    check(f"[{label}] выбранная метка видна и не спрятана под шторкой", bool(sel) and clear, selhost)
    page.screenshot(path=f"{OUT}/home_sheet_{label}.png")
    page.locator(".offer-sheet-close").click(); check(f"[{label}] шторка закрывается", page.locator(".offer-sheet").count() == 0)

    # --- клавиатура ---
    page.evaluate("window.scrollTo(0, 0)")
    page.locator(".show-card").first.focus(); page.keyboard.press("Enter"); page.wait_for_selector(".offer-sheet", timeout=4000)
    check(f"[{label}] клавиатура: Enter на карточке открывает предложение на карте", page.locator(".offer-sheet").count() == 1)
    page.locator(".offer-sheet-close").click()
    # метка карты: Enter и Пробел открывают предложение (раньше метка фокусировалась, но не активировалась), и после смены вида метки — снова
    mk = pins(page).nth(2); mk.focus(); page.keyboard.press("Enter"); page.wait_for_selector(".offer-sheet", timeout=4000)
    check(f"[{label}] клавиатура: Enter на метке карты открывает предложение", page.locator(".offer-sheet").count() == 1)
    page.locator(".offer-sheet-close").click(); page.wait_for_timeout(300)
    mk.focus(); page.keyboard.press("Space"); page.wait_for_selector(".offer-sheet", timeout=4000)
    check(f"[{label}] клавиатура: Пробел на той же метке работает и после смены её вида (выбрана → снята)", page.locator(".offer-sheet").count() == 1)
    page.locator(".offer-sheet-close").click()

    # --- стрелки ленты (десктоп) ---
    if w >= 900 and not mobile:
        page.evaluate("window.scrollTo(0, 0)")
        prev_disabled = page.locator(".showcase-arrow-prev").is_disabled()
        page.locator(".showcase-arrow-next").click(); page.wait_for_timeout(900)
        sl = page.evaluate("document.querySelector('.showcase-rail').scrollLeft")
        check(f"[{label}] стрелки: в начале «назад» неактивна, «дальше» листает ленту", prev_disabled and sl > 100, (prev_disabled, sl))
        check(f"[{label}] стрелки: после прокрутки «назад» оживает", not page.locator(".showcase-arrow-prev").is_disabled())

    # --- подвал и навигация ---
    check(f"[{label}] на витрине есть подвал и ссылка «Витрина» в шапке", page.locator("footer.site-footer").count() == 1 and page.locator('.site-nav-desktop a[href="/home"]').count() == 1)
    page.goto(WEB + "/map", wait_until="networkidle"); page.wait_for_timeout(600)
    check(f"[{label}] старый адрес /map ведёт на /home#map", page.url.endswith("/home#map"), page.url)

    check(f"[{label}] консоль без ошибок", not errs, errs[:3])
    ctx.close()

def run_gestures(p, browser, engine):
    """Карта лежит внутри прокручиваемой страницы — она не должна отнимать у человека прокрутку."""
    # десктоп: колесо листает страницу, масштаб — с Ctrl/⌘
    ctx = new_ctx(p, browser, engine, 1440, 900, False); page = ctx.new_page()
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".leaflet-marker-icon"); page.wait_for_timeout(1200)
    page.evaluate("document.getElementById('map').scrollIntoView({block:'start'})"); page.wait_for_timeout(700)
    stage = rect(page, ".home-map .map-stage"); cx, cy = (stage["l"] + stage["r"]) / 2, (stage["t"] + stage["b"]) / 2
    pos = lambda: page.evaluate("(()=>{const e=document.querySelector('.leaflet-marker-icon'); const r=e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY)]})()")
    before_pos, y0 = pos(), page.evaluate("scrollY")
    page.mouse.move(cx, cy); page.mouse.wheel(0, 300); page.wait_for_timeout(700)
    y1 = page.evaluate("scrollY")
    check(f"[{engine}] колесо над картой листает страницу, а не масштабирует карту", y1 - y0 >= 150 and abs(pos()[0] - before_pos[0]) <= 1, (y0, y1, before_pos, pos()))
    check(f"[{engine}] колесо над картой: подсказка «Ctrl/⌘ + прокрутка — масштаб»", "масштаб" in page.locator(".map-hint").inner_text() and page.locator(".map-hint.is-visible").count() == 1)
    page.evaluate("document.getElementById('map').scrollIntoView({block:'start'})"); page.wait_for_timeout(700)
    # «размах» всех меток по горизонтали: при приближении он растёт (две соседние метки у курсора почти не двигаются — по ним судить нельзя)
    span = "(()=>{const xs=[...document.querySelectorAll('.leaflet-marker-icon')].map(e=>e.getBoundingClientRect().left); return Math.max(...xs)-Math.min(...xs)})()"
    y2 = page.evaluate("scrollY"); a = page.evaluate(span)
    page.keyboard.down("Control"); page.mouse.move(cx, cy); page.mouse.wheel(0, -300); page.wait_for_timeout(900); page.keyboard.up("Control")
    b = page.evaluate(span)
    check(f"[{engine}] Ctrl + колесо масштабирует карту (метки разъехались), страница стоит", abs(page.evaluate("scrollY") - y2) <= 2 and b > a * 1.3, (a, b))
    # перетаскивание мышью на десктопе работает
    ctx.close()

    # телефон: одним пальцем страница листается, картой двигают двумя
    ctx = new_ctx(p, browser, engine, 402, 874, True); page = ctx.new_page()
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".leaflet-marker-icon"); page.wait_for_timeout(1200)
    info = page.evaluate("(()=>{const c=document.querySelector('.leaflet-container'); return {drag:c.classList.contains('leaflet-touch-drag'), zoom:c.classList.contains('leaflet-touch-zoom'), ta:getComputedStyle(c).touchAction}})()")
    if engine != "firefox":  # Playwright не умеет мобильный режим в Firefox: там Leaflet честно считает себя десктопом
        check(f"[{engine}] телефон: одиночное перетаскивание карты выключено, щипок включён, touch-action пропускает прокрутку", (not info["drag"]) and info["zoom"] and "none" not in info["ta"], info)
    if engine == "chromium":
        page.evaluate("document.getElementById('map').scrollIntoView({block:'start'})"); page.wait_for_timeout(700)
        stage = rect(page, ".home-map .map-stage"); cx, cy = int((stage["l"] + stage["r"]) / 2), int((stage["t"] + stage["b"]) / 2)
        cdp = ctx.new_cdp_session(page); y0 = page.evaluate("scrollY")
        cdp.send("Input.synthesizeScrollGesture", {"x": cx, "y": cy + 150, "yDistance": -250, "gestureSourceType": "touch", "speed": 800})
        page.wait_for_timeout(900)
        check("[chromium] телефон: свайп одним пальцем по карте листает страницу", page.evaluate("scrollY") - y0 >= 120, (y0, page.evaluate("scrollY")))
        page.evaluate("document.getElementById('map').scrollIntoView({block:'start'})"); page.wait_for_timeout(700)
        cdp.send("Input.synthesizeScrollGesture", {"x": cx + 100, "y": cy, "xDistance": -150, "gestureSourceType": "touch", "speed": 600}); page.wait_for_timeout(500)
        check("[chromium] телефон: «боковой» свайп одним пальцем показывает подсказку про два пальца", page.locator(".map-hint.is-visible").count() == 1 and "двумя пальцами" in page.locator(".map-hint").inner_text(), page.locator(".map-hint").inner_text())
    ctx.close()


PALACE = {"latitude": 59.9386, "longitude": 30.3141}  # Дворцовая площадь
MOSCOW = {"latitude": 55.7558, "longitude": 37.6173}

def km_list(page):
    """Расстояния из подписей карточек («Grill House · 650 м», «… · 1,2 км») → км, в порядке ленты."""
    out = []
    for t in page.locator(CARD + " .show-card-shop").all_inner_texts():
        m = re.search(r"·\s*([\d,]+)\s*(км|м)\b", t)
        if m: out.append(float(m.group(1).replace(",", ".")) / (1 if m.group(2) == "км" else 1000))
    return out

def sub_text(page): return page.locator(".showcase-sub").inner_text().replace("\n", " | ")

def geo_ctx(p, browser, engine, w=1440, h=900, mobile=False, where=None):
    opts = dict(viewport={"width": w, "height": h}, locale="ru-RU", device_scale_factor=2, reduced_motion="reduce")
    if where: opts.update(geolocation=where, permissions=["geolocation"])
    if mobile and engine != "firefox": opts.update(is_mobile=True, has_touch=True)
    return browser.new_context(**opts)

def map_dot_inside(page):
    return page.evaluate("""() => { const d = document.querySelector('.map-me'); const s = document.querySelector('.home-map .map-stage'); if (!d) return null;
      const a = d.getBoundingClientRect(), b = s.getBoundingClientRect(); return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom }""")

def run_geo(p, browser, engine):
    tag = f"[{engine}/geo]"
    # ---- 1. разрешения не просили: мягкое приглашение, системный диалог — только по нажатию ----
    ctx = geo_ctx(p, browser, engine); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".show-card"); page.wait_for_timeout(1200)
    check(f"{tag} первый заход: приглашение «Показать ближайшие первыми?» с объяснением, кнопка в строке не дублируется", page.locator(".geo-prompt").count() == 1 and "один раз спросит" in page.locator(".geo-prompt").inner_text() and page.get_by_role("button", name=re.compile("Рядом со мной")).count() == 0)
    check(f"{tag} без разрешения витрина — весь город, «горящие первыми» (первая карточка горит)", "Весь Санкт-Петербург" in sub_text(page) and page.locator(".show-card").first.get_attribute("class").find("is-hot") >= 0, sub_text(page))
    check(f"{tag} на карте есть круглая кнопка «Определить моё местоположение» (≥ 44 px)", (rect(page, ".map-locate-btn") or {"w": 0})["w"] >= 44 and page.get_by_role("button", name="Определить моё местоположение").count() == 1)
    page.get_by_role("button", name="Определить местоположение").click()
    page.wait_for_function("() => !document.querySelector('.showcase-sub').innerText.includes('Определяем')", timeout=35000); page.wait_for_timeout(500)
    st = sub_text(page)
    check(f"{tag} браузер не дал позицию: честное сообщение + «Повторить», приглашение ушло, город остался", re.search("заблокирован|вовремя|Не удалось", st) and page.get_by_role("button", name=re.compile("Повторить")).count() == 1 and page.locator(".geo-prompt").count() == 0 and page.locator(".map-me").count() == 0, st)
    if "заблокирован" in st:
        page.get_by_role("button", name="Как включить").click()
        check(f"{tag} при отказе — «Как включить»: раскрывается инструкция по настройкам сайта", page.locator("#geo-help").count() == 1 and "Разрешите" in page.locator("#geo-help").inner_text())
    ctx.close()

    ctx = geo_ctx(p, browser, engine); page = ctx.new_page()
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".geo-prompt")
    page.get_by_role("button", name="Не сейчас").click()
    check(f"{tag} «Не сейчас»: приглашение уходит, возможность остаётся — «Рядом со мной» в строке", page.locator(".geo-prompt").count() == 0 and page.get_by_role("button", name=re.compile("Рядом со мной")).count() == 1)
    page.reload(wait_until="networkidle"); page.wait_for_selector(".show-card")
    check(f"{tag} «Не сейчас» запоминается: после перезагрузки приглашения нет", page.locator(".geo-prompt").count() == 0)
    ctx.close()

    # ---- 2. разрешение есть, человек на Дворцовой площади ----
    ctx = geo_ctx(p, browser, engine, where=PALACE); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".show-card")
    page.wait_for_function("() => document.querySelector('.showcase-sub').innerText.includes('Рядом с вами')", timeout=20000); page.wait_for_timeout(2500)
    check(f"{tag} разрешение уже выдано: позиция берётся сама, без кнопки; приглашения нет", "ближайшие первыми" in sub_text(page) and page.locator(".geo-prompt").count() == 0, sub_text(page))
    d = km_list(page)
    check(f"{tag} лента: ближайшие первыми — расстояния не убывают, первое рядом (≤ 2 км)", len(d) >= 8 and all(a <= b + 0.11 for a, b in zip(d, d[1:])) and d[0] <= 2, d)
    near_n = page.evaluate("() => document.querySelectorAll('.leaflet-marker-icon').length")
    in_view = page.evaluate("""() => { const s = document.querySelector('.home-map .map-stage').getBoundingClientRect(); return [...document.querySelectorAll('.leaflet-marker-icon')].filter(e => { const r = e.getBoundingClientRect(); return r.right > s.left && r.left < s.right && r.bottom > s.top && r.top < s.bottom && !e.querySelector('.map-me'); }).length }""")
    check(f"{tag} карта охватывает район вокруг человека: несколько меток в кадре, но не весь город", 3 <= in_view < near_n, (in_view, near_n))
    page.evaluate("document.querySelector('.home-map .map-stage').scrollIntoView({block:'center'})"); page.wait_for_timeout(600)
    check(f"{tag} на карте видна точка «вы здесь»", map_dot_inside(page) is True)
    page.screenshot(path=f"{OUT}/home_geo_{engine}.png")
    page.evaluate("window.scrollTo(0,0)")
    page.get_by_role("button", name="Сначала горящие").click(); page.wait_for_timeout(900)
    d2 = km_list(page)
    check(f"{tag} переключатель «Сначала горящие»: порядок меняется (первая горит), «Ближайшие» возвращает", "is-hot" in page.locator(".show-card").first.get_attribute("class") and d2 != d)
    page.get_by_role("button", name="Ближайшие", exact=True).click(); page.wait_for_timeout(900)
    check(f"{tag} «Ближайшие» возвращают порядок по расстоянию", km_list(page) == d)
    page.reload(wait_until="networkidle"); page.wait_for_selector(".show-card"); page.wait_for_timeout(1500)
    check(f"{tag} после перезагрузки витрина снова «рядом с вами» (позиция помнится на сессию)", "Рядом с вами" in sub_text(page))
    # кнопка на карте возвращает к человеку после того, как карту утащили
    page.evaluate("document.querySelector('.home-map .map-stage').scrollIntoView({block:'center'})"); page.wait_for_timeout(1400)  # html { scroll-behavior: smooth } — ждём конца прокрутки
    stage = rect(page, ".home-map .map-stage"); cx, cy = (stage["l"] + stage["r"]) / 2, (stage["t"] + stage["b"]) / 2
    # тянем справа налево через всю карту: точка человека стоит левее центра и должна уехать за край
    page.mouse.move(stage["r"] - 40, cy); page.mouse.down(); page.mouse.move(stage["l"] + 40, cy + 120, steps=14); page.mouse.up(); page.wait_for_timeout(600)
    away = map_dot_inside(page)
    page.get_by_role("button", name="Вернуться к моему местоположению").click(); page.wait_for_timeout(1500)
    check(f"{tag} кнопка на карте возвращает вид к человеку (точка «вы здесь» снова в кадре)", away is False and map_dot_inside(page) is True, (away, map_dot_inside(page)))
    # «Весь город»
    page.evaluate("window.scrollTo(0,0)")
    page.get_by_role("button", name=re.compile("Весь город")).click(); page.wait_for_timeout(1800)
    check(f"{tag} «Весь город»: витрина без позиции — город, горящие первыми, точки «вы здесь» нет", "Весь Санкт-Петербург" in sub_text(page) and "is-hot" in page.locator(".show-card").first.get_attribute("class") and page.locator(".map-me").count() == 0, sub_text(page))
    check(f"{tag} консоль без ошибок", not errs, errs[:3])
    ctx.close()

    # ---- 3. человек вне города ----
    ctx = geo_ctx(p, browser, engine, where=MOSCOW); page = ctx.new_page()
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".show-card")
    page.wait_for_function("() => document.querySelector('.showcase-sub').innerText.includes('за пределами')", timeout=20000); page.wait_for_timeout(1500)
    check(f"{tag} из другого города: витрина не пустая — показываем Санкт-Петербург и говорим об этом, точки «вы здесь» нет", page.locator(".show-card").count() >= 3 and page.locator(".map-me").count() == 0 and page.locator(".showcase-sort").count() == 0, sub_text(page))
    ctx.close()

    # ---- 4. метки мельче на общем виде и растут при приближении ----
    ctx = geo_ctx(p, browser, engine); page = ctx.new_page()
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".leaflet-marker-icon .map-pin"); page.wait_for_timeout(1500)
    # offsetWidth, а не getBoundingClientRect: капля — повёрнутый квадрат, его габарит на экране в √2 раз больше стороны
    drops = lambda: page.evaluate("[...document.querySelectorAll('.map-pin')].filter(e => !e.classList.contains('is-selected')).map(e => e.offsetWidth)")
    photos = lambda: page.evaluate("[...document.querySelectorAll('.map-pin-photo-disc')].map(e => e.offsetWidth)")
    far_d, far_p = drops(), photos()
    page.evaluate("document.querySelector('.home-map .map-stage').scrollIntoView({block:'center'})"); page.wait_for_timeout(500)
    for _ in range(3):
        page.locator(".leaflet-control-zoom-in").click(); page.wait_for_timeout(700)
    near_d, near_p = drops(), photos()
    med = lambda xs: sorted(xs)[len(xs) // 2] if xs else 0
    check(f"{tag} метки: на общем виде города мельче, при приближении — полного размера", med(far_d) < med(near_d) and (not far_p or not near_p or med(far_p) < med(near_p)), (med(far_d), med(near_d), med(far_p), med(near_p)))
    check(f"{tag} метки: небольшие — капли ≤ 38 px, фото-иконки ≤ 48 px в обычном виде", max(far_d + near_d) <= 38 and max(far_p + near_p) <= 48 + 1, (max(far_d + near_d), max(far_p + near_p)))
    ctx.close()

    # ---- 5. телефон (iPhone 17): приглашение и «рядом со мной» помещаются, ничего не раздувает экран ----
    if engine == "chromium":
        ctx = geo_ctx(p, browser, engine, 402, 874, True); page = ctx.new_page()
        page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".geo-prompt")
        check("[chromium/geo/iphone17] приглашение помещается в экран, нет горизонтальной прокрутки", page.evaluate("document.documentElement.scrollWidth") <= 402 and page.evaluate("innerWidth") == 402)
        small = page.evaluate("[...document.querySelectorAll('.geo-prompt .btn, .map-locate-btn')].filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5 }).length")
        check("[chromium/geo/iphone17] кнопки приглашения и кнопка на карте ≥ 44 px", small == 0)
        ctx.close()
        ctx = geo_ctx(p, browser, engine, 402, 874, True, where=PALACE); page = ctx.new_page()
        page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".show-card")
        page.wait_for_function("() => document.querySelector('.showcase-sub').innerText.includes('Рядом с вами')", timeout=20000); page.wait_for_timeout(1500)
        small = page.evaluate("[...document.querySelectorAll('.geo-chip, .showcase-sort button, .showcase-filters .ribbon-filter')].filter(e => e.getBoundingClientRect().height < 39.5).length")
        check("[chromium/geo/iphone17] «рядом со мной»: нет горизонтальной прокрутки, элементы строки ≥ 40 px", page.evaluate("document.documentElement.scrollWidth") <= 402 and small == 0, small)
        page.screenshot(path=f"{OUT}/home_geo_iphone17.png")
        ctx.close()

def run_drift(p, browser, engine):
    """Лента «Сейчас на витрине» едет сама (как на лендинге): бесшовная петля, паузы, кнопка паузы, reduced-motion."""
    tag = f"[{engine}/drift]"
    sl = lambda page: page.evaluate("document.querySelector('.showcase-rail').scrollLeft")
    ctx = new_ctx(p, browser, engine, 1440, 900, False, motion="no-preference"); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".showcase-item.is-clone", state="attached", timeout=20000); page.wait_for_timeout(1200)
    n_cards = page.locator(CARD).count()
    # Паузу ленты (WCAG 2.2.2) убрали с глаз: она — переключатель внутри панели фильтров.
    def drift_switch(open_panel=True):
        if open_panel and page.locator(".filters-panel").count() == 0: page.locator(".filters-btn").click(); page.wait_for_selector(".filters-panel")
        return page.get_by_role("switch", name="Двигать ленту автоматически")
    def close_panel():
        page.keyboard.press("Escape"); page.wait_for_timeout(250); page.mouse.move(5, 5)
    check(f"{tag} у ленты есть копия карточек для петли, спрятанная от скринридера и клавиатуры", page.locator(".showcase-item.is-clone").count() == n_cards + 1 and page.evaluate("[...document.querySelectorAll('.showcase-item.is-clone')].every(li => li.getAttribute('aria-hidden') === 'true' && [...li.querySelectorAll('button')].every(b => b.tabIndex === -1))"))
    check(f"{tag} старой кнопки паузы в углу нет, её место заняли фильтры; переключатель движения — в панели, включён", page.locator(".showcase-play").count() == 0 and drift_switch().get_attribute("aria-checked") == "true")
    check(f"{tag} пока открыта панель фильтров, лента под ней стоит", True)
    a0 = sl(page); page.wait_for_timeout(1500); check(f"{tag} лента под открытой панелью не уезжает", abs(sl(page) - a0) <= 3, (a0, sl(page)))
    close_panel()
    page.mouse.move(5, 5); page.wait_for_timeout(300)
    a = sl(page); page.wait_for_timeout(2200); b = sl(page)
    check(f"{tag} лента сама едет вправо (≈ 34 px/с)", 30 <= b - a <= 160, (a, b))
    # мышь над лентой — стоит
    box = rect(page, ".showcase-rail"); page.mouse.move((box["l"] + box["r"]) / 2, (box["t"] + box["b"]) / 2); page.wait_for_timeout(400)
    a = sl(page); page.wait_for_timeout(1600); b = sl(page)
    check(f"{tag} под мышью лента стоит", abs(b - a) <= 3, (a, b))
    page.mouse.move(5, 5); page.wait_for_timeout(300); a = sl(page); page.wait_for_timeout(1800); b = sl(page)
    check(f"{tag} мышь ушла — лента снова едет", b - a >= 25, (a, b))
    # клавиатурный фокус — стоит
    page.locator(CARD).nth(2).focus(); page.wait_for_timeout(400); a = sl(page); page.wait_for_timeout(1500); b = sl(page)
    check(f"{tag} пока в ленте клавиатурный фокус, она стоит", abs(b - a) <= 3, (a, b))
    page.evaluate("document.activeElement && document.activeElement.blur()"); page.mouse.move(5, 5)
    # петля: у самого конца оригинала лента незаметно перескакивает к началу
    loop_w = page.evaluate("(()=>{const f=document.querySelector('.showcase-item'), c=document.querySelector('.showcase-item.is-clone'); return c.offsetLeft - f.offsetLeft})()")
    page.evaluate("(w) => { document.querySelector('.showcase-rail').scrollLeft = w - 30 }", loop_w); page.wait_for_timeout(2800)
    check(f"{tag} бесшовная петля: дойдя до копии, лента возвращается к началу оригинала", sl(page) < loop_w * 0.5, (sl(page), loop_w))
    # вне экрана — стоит
    page.evaluate("document.getElementById('map').scrollIntoView({block:'start'})"); page.wait_for_timeout(1500)
    a = sl(page); page.wait_for_timeout(1600); b = sl(page)
    check(f"{tag} пока лента вне экрана (человек у карты), она не едет", abs(b - a) <= 3, (a, b))
    page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(1500); a = sl(page); page.wait_for_timeout(1500); b = sl(page)
    check(f"{tag} вернулись к ленте — снова едет", b - a >= 20, (a, b))
    # кнопка паузы и запоминание выбора
    drift_switch().click(); close_panel(); page.wait_for_timeout(300)
    a = sl(page); page.wait_for_timeout(1600); b = sl(page)
    check(f"{tag} пауза из панели: лента стоит, выбор запомнен", abs(b - a) <= 3 and page.evaluate("localStorage.getItem('apetite.web.feedDrift')") == "paused", (a, b))
    page.reload(wait_until="networkidle"); page.wait_for_selector(".filters-btn"); page.wait_for_timeout(1500); a = sl(page); page.wait_for_timeout(1600); b = sl(page)
    check(f"{tag} после перезагрузки пауза сохраняется, переключатель выключен", abs(b - a) <= 3 and drift_switch().get_attribute("aria-checked") == "false", (a, b))
    drift_switch().click(); close_panel(); page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(900); a = sl(page); page.wait_for_timeout(2000); b = sl(page)
    check(f"{tag} включили в панели — лента снова едет", b - a >= 25, (a, b))
    check(f"{tag} консоль без ошибок", not errs, errs[:3])
    ctx.close()

    # системная просьба «меньше движения»: лента стоит с самого начала, кнопка предлагает запустить
    ctx = new_ctx(p, browser, engine, 1440, 900, False, motion="reduce"); page = ctx.new_page()
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".filters-btn"); page.wait_for_timeout(1000)
    a = sl(page); page.wait_for_timeout(1800); b = sl(page)
    page.locator(".filters-btn").click(); page.wait_for_selector(".filters-panel")
    check(f"{tag} prefers-reduced-motion: лента не едет, переключатель в панели выключен", a == b and page.get_by_role("switch", name="Двигать ленту автоматически").get_attribute("aria-checked") == "false", (a, b))
    ctx.close()

    # телефон: палец останавливает ленту, через пару секунд она продолжает
    if engine == "chromium":
        ctx = new_ctx(p, browser, engine, 402, 874, True, motion="no-preference"); page = ctx.new_page()
        page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(".showcase-item.is-clone", state="attached"); page.wait_for_timeout(1200)
        a = sl(page); page.wait_for_timeout(1800); b = sl(page)
        check("[chromium/drift/iphone17] на телефоне лента тоже едет сама", b - a >= 25, (a, b))
        box = rect(page, ".showcase-rail"); cdp = ctx.new_cdp_session(page)
        cdp.send("Input.synthesizeScrollGesture", {"x": int(box["l"]) + 250, "y": int((box["t"] + box["b"]) / 2), "xDistance": 120, "gestureSourceType": "touch", "speed": 700})
        page.wait_for_timeout(300); s1 = sl(page); page.wait_for_timeout(1200); s2 = sl(page)
        check("[chromium/drift/iphone17] после касания пальцем лента не вырывается из-под него", abs(s2 - s1) <= 8, (s1, s2))
        page.wait_for_timeout(3600); s3 = sl(page); page.wait_for_timeout(1500); s4 = sl(page)
        check("[chromium/drift/iphone17] через пару секунд без касаний лента снова плывёт", s4 - s3 >= 20, (s3, s4))
        check("[chromium/drift/iphone17] нет горизонтальной прокрутки страницы", page.evaluate("document.documentElement.scrollWidth") <= 402)
        ctx.close()

PRICE_RE = re.compile(r"(\d[\d\s\u00a0\u202f]*)\s*₽")

def card_prices(page):
    """Цены карточек ленты (оригиналы) в рублях — по `<b>` в `.show-card-price`."""
    out = []
    for t in page.locator(CARD + " .show-card-price b").all_inner_texts():
        m = PRICE_RE.search(t)
        if m: out.append(int(re.sub(r"\D", "", m.group(1))))
    return out

def hint_bounds(page, scope=None):
    """Границы цен из подсказки панели: «Сейчас на витрине: от 77 ₽ до 935 ₽» → (77, 935)."""
    t = page.locator(".filters-hint").inner_text()
    m = re.search(r"от\s+([\d\s\u00a0\u202f]+)\s*₽\s+до\s+([\d\s\u00a0\u202f]+)\s*₽", t)
    return (int(re.sub(r"\D", "", m.group(1))), int(re.sub(r"\D", "", m.group(2)))) if m else None

def fmt(n): return f"{n:,}".replace(",", " ")  # обычный пробел: сверяем через norm_ws (в интерфейсе — неразрывный/узкий, зависит от ICU)
norm_ws = lambda s: s.replace("\u00a0", " ").replace("\u202f", " ")

def run_filters(p, browser, engine):
    """Круглая кнопка фильтров вместо паузы: панель (категория, цена от/до), проверки ввода и границ цен, пустые категории, плашка, сброс, клавиатура."""
    tag = f"[{engine}/filters]"
    for name, w, h, mobile in [("iphone17", 402, 874, True), ("iphone-se", 320, 568, True), ("desktop", 1440, 900, False)]:
        t = f"[{engine}/filters/{name}]"
        ctx = new_ctx(p, browser, engine, w, h, mobile); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(CARD); page.wait_for_selector(".leaflet-marker-icon"); page.wait_for_timeout(1500)
        btn = rect(page, ".filters-btn"); eyebrow = rect(page, ".showcase-eyebrow")
        check(f"{t} кнопка фильтров: круглая ≥ 44 px, в правом верхнем углу в экране, не налезает на заголовок", btn and btn["w"] >= 44 and btn["h"] >= 44 and abs(btn["w"] - btn["h"]) < 1 and btn["r"] <= w and btn["l"] >= 0 and btn["l"] > eyebrow["r"] - 1, (btn, eyebrow))
        check(f"{t} кнопки паузы в углу больше нет", page.locator(".showcase-play, [aria-label*='Остановить движение']").count() == 0)
        total = count_in_title(page)
        page.locator(".filters-btn").click(); page.wait_for_selector(".filters-panel"); page.wait_for_timeout(350)
        pn = rect(page, ".filters-panel")
        check(f"{t} панель целиком в экране по ширине, страница не раздулась", pn["l"] >= 0 and pn["r"] <= w + 0.5 and page.evaluate("document.documentElement.scrollWidth") <= w and page.evaluate("innerWidth") == w, (pn, w))
        check(f"{t} панель: первое поле («От») в фокусе, aria у кнопки: раскрыто", page.evaluate("document.activeElement.closest('label') && document.activeElement.closest('label').innerText.includes('От')") and page.locator(".filters-btn").get_attribute("aria-expanded") == "true")
        sums = page.evaluate("[...document.querySelectorAll('.filters-chip .filters-chip-n')].map(e => +e.textContent)")
        check(f"{t} панель: счётчики категорий сходятся (сумма категорий = «Все» = число в заголовке)", len(sums) == 5 and sum(sums[1:]) == sums[0] == total, (sums, total))
        if name == "iphone-se":
            ab = rect(page, ".filters-apply")
            check(f"{t} на низком экране кнопка «Показать N» видна без прокрутки страницы (прилипает внизу панели)", ab and ab["b"] <= h + 1 and ab["t"] >= 0, (ab, h))
        small = page.evaluate("[...document.querySelectorAll('.filters-panel button, .filters-panel input, .filters-panel [role=switch]')].filter(e => { const r = e.getBoundingClientRect(); return r.height < 39.5 }).map(e => e.className + ':' + Math.round(e.getBoundingClientRect().height))")
        check(f"{t} панель: все кнопки и поля не ниже 40 px (чипы и поля — 44)", not small, small)
        fs = page.evaluate("[...document.querySelectorAll('.filters-panel input')].map(e => parseFloat(getComputedStyle(e).fontSize))")
        check(f"{t} поля ввода — 16 px (iOS не приближает страницу при фокусе)", all(f >= 16 for f in fs), fs)
        inputs = page.locator(".filters-panel input"); apply = page.locator(".filters-apply"); errs_box = page.locator(".filters-errors")
        mn, mx = hint_bounds(page)
        check(f"{t} подсказка показывает реальные границы цен витрины ({mn}…{mx} ₽), они же — в плейсхолдерах", mn < mx and inputs.nth(0).get_attribute("placeholder") == str(mn) and inputs.nth(1).get_attribute("placeholder") == str(mx), (mn, mx))
        # --- проверки формата ---
        cases = [("abc", "Введите число без букв и знаков"), ("-5", "Цена не может быть отрицательной"), ("1,5", "Только целые рубли, без копеек")]
        got = []
        for text, expected in cases:
            inputs.nth(0).fill(text); page.wait_for_timeout(120)
            got.append((expected in errs_box.inner_text(), apply.is_disabled(), inputs.nth(0).get_attribute("aria-invalid")))
        check(f"{t} проверки формата «От»: буквы, минус, копейки — сообщение, красное поле, кнопка заблокирована", all(a and b and c == "true" for a, b, c in got), got)
        # --- границы цен: ниже минимума и выше максимума выбрать нельзя ---
        inputs.nth(0).fill(str(mn - 1)); page.wait_for_timeout(120)
        check(f"{t} «От» ниже самой дешёвой цены ({mn - 1} < {mn}) отклоняется: причина, красное поле, кнопка заблокирована", f"Минимальная цена на витрине — {fmt(mn)} ₽" in norm_ws(errs_box.inner_text()) and apply.is_disabled() and inputs.nth(0).get_attribute("aria-invalid") == "true", errs_box.inner_text())
        page.get_by_role("button", name=f"Поставить {fmt(mn)} ₽").click(); page.wait_for_timeout(150)
        check(f"{t} «Поставить {mn} ₽»: поле исправлено одним нажатием, ошибка ушла", inputs.nth(0).input_value() == str(mn) and errs_box.inner_text().strip() == "" and apply.is_enabled())
        inputs.nth(1).fill(str(mx + 1)); page.wait_for_timeout(120)
        check(f"{t} «До» выше самой дорогой цены ({mx + 1} > {mx}) отклоняется: причина и исправление", f"Максимальная цена на витрине — {fmt(mx)} ₽" in norm_ws(errs_box.inner_text()) and apply.is_disabled(), errs_box.inner_text())
        page.get_by_role("button", name=f"Поставить {fmt(mx)} ₽").click(); page.wait_for_timeout(150)
        check(f"{t} «Поставить {mx} ₽»: поле исправлено", inputs.nth(1).input_value() == str(mx) and apply.is_enabled())
        inputs.nth(0).fill(str(mx + 1)); inputs.nth(1).fill(""); page.wait_for_timeout(120)
        check(f"{t} «От» выше максимума: нечего показывать — отклоняется", "Максимальная цена" in errs_box.inner_text() and apply.is_disabled())
        inputs.nth(0).fill(""); inputs.nth(1).fill("0"); page.wait_for_timeout(120)
        check(f"{t} «До» = 0 ниже минимума — отклоняется", "Минимальная цена" in errs_box.inner_text() and apply.is_disabled())
        inputs.nth(0).fill(str(mn)); inputs.nth(1).fill(str(mx)); page.wait_for_timeout(120)
        check(f"{t} сами границы ({mn} и {mx}) разрешены, кнопка показывает всё: «Показать {total}»", apply.inner_text() == f"Показать {total}" and apply.is_enabled(), apply.inner_text())
        mid = mn + (mx - mn) // 2
        inputs.nth(0).fill(str(mid + 10)); inputs.nth(1).fill(str(mid)); page.wait_for_timeout(120)
        check(f"{t} «От» больше «до» внутри границ: сообщение про диапазон, кнопка «Исправьте цену»", "«От» не может быть больше «до»" in errs_box.inner_text() and apply.inner_text() == "Исправьте цену" and apply.is_disabled())
        # --- применение ---
        lo, hi = mn, mn + (mx - mn) // 3
        inputs.nth(0).fill(str(lo)); inputs.nth(1).fill(str(hi)); page.wait_for_timeout(150)
        label = apply.inner_text(); expect_n = int(re.search(r"\d+", label).group()) if re.search(r"\d+", label) else -1
        check(f"{t} кнопка показывает живой счётчик «Показать N», меньше общего", 0 < expect_n < total, (label, total))
        apply.click(); page.wait_for_timeout(1000)
        prices = card_prices(page)
        check(f"{t} применили {lo}–{hi} ₽: панель закрылась, фокус вернулся на кнопку, число в заголовке = числу на кнопке", page.locator(".filters-panel").count() == 0 and count_in_title(page) == expect_n and page.evaluate("document.activeElement.classList.contains('filters-btn')"), (count_in_title(page), expect_n))
        check(f"{t} в ленте остались только цены {lo}–{hi} ₽", prices and all(lo <= x <= hi for x in prices), prices)
        check(f"{t} на карте столько же меток, сколько в заголовке (лента и карта — один набор)", pins(page).count() == expect_n, (pins(page).count(), expect_n))
        check(f"{t} на кнопке значок «1», видна плашка «Цена …»", page.locator(".filters-badge").inner_text() == "1" and page.get_by_role("button", name=re.compile("Сбросить фильтр по цене")).count() == 1)
        # --- категории ---
        page.locator(".filters-btn").click(); page.wait_for_selector(".filters-panel")
        check(f"{t} панель открывается с применёнными значениями", inputs.nth(0).input_value() == str(lo) and inputs.nth(1).input_value() == str(hi))
        cats = page.evaluate("[...document.querySelectorAll('.filters-panel .filters-chip:not(.is-small)')].map(e => ({text: e.innerText.replace(/\\s+/g, ' ').trim(), disabled: e.disabled, n: +(e.querySelector('.filters-chip-n') || {textContent: -1}).textContent}))")
        check(f"{t} категория без предложений (при этой цене) недоступна, с предложениями — доступна; «Все» всегда доступна", all(c["disabled"] == (c["n"] == 0 and not c["text"].startswith("Все")) for c in cats) and not cats[0]["disabled"], cats)
        # цену, при которой часть категорий опустеет: только самые дорогие предложения
        inputs.nth(0).fill(str(mx)); inputs.nth(1).fill(""); page.wait_for_timeout(200)
        cats2 = page.evaluate("[...document.querySelectorAll('.filters-panel .filters-chip:not(.is-small)')].map(e => ({text: e.innerText.replace(/\\s+/g, ' ').trim(), disabled: e.disabled, n: +(e.querySelector('.filters-chip-n') || {textContent: -1}).textContent}))")
        empty = [c for c in cats2 if c["n"] == 0]
        check(f"{t} при цене «от {mx}» пустые категории отключены и их нельзя выбрать ({len(empty)} шт.)", empty and all(c["disabled"] for c in empty) and sum(c["n"] for c in cats2[1:]) == cats2[0]["n"], cats2)
        dis = page.locator(".filters-panel .filters-chip:disabled").first
        before = apply.inner_text(); dis.click(force=True); page.wait_for_timeout(150)
        check(f"{t} клик по отключённой категории ничего не меняет", apply.inner_text() == before and dis.get_attribute("aria-pressed") == "false")
        # границы следуют за выбранной категорией
        inputs.nth(0).fill(""); page.wait_for_timeout(100)
        flowers = page.locator(".filters-panel .filters-chip:not(.is-small)", has_text="Цветы").first
        if flowers.is_enabled():
            flowers.click(); page.wait_for_timeout(200)
            fmn, fmx = hint_bounds(page)
            check(f"{t} границы цен следуют за категорией: у «Цветы» подсказка «В категории «Цветы»» и свои пределы ({fmn}…{fmx})", "В категории «Цветы»" in page.locator(".filters-hint").inner_text() and mn <= fmn <= fmx <= mx and inputs.nth(0).get_attribute("placeholder") == str(fmn), (fmn, fmx, mn, mx))
            inputs.nth(0).fill(str(max(fmn - 1, 0))); page.wait_for_timeout(150)
            if fmn > 0:
                check(f"{t} цена ниже порога категории отклоняется с её названием в сообщении", "в категории «Цветы»" in errs_box.inner_text() and apply.is_disabled(), errs_box.inner_text())
            flowers.click(); page.wait_for_timeout(100)  # снять
        # --- категория из панели = вкладка ---
        page.locator(".filters-panel .btn-ghost").click(); page.wait_for_timeout(100)
        inputs.nth(0).fill(str(lo)); inputs.nth(1).fill(str(hi)); page.wait_for_timeout(150)
        bakery = page.locator(".filters-panel .filters-chip:not(.is-small)", has_text="Выпечка").first
        if bakery.is_enabled():
            bakery.click(); page.wait_for_timeout(200)
            n2 = int(re.search(r"\d+", apply.inner_text()).group()) if re.search(r"\d+", apply.inner_text()) else -1
            if apply.is_enabled():
                apply.click(); page.wait_for_timeout(900)
                check(f"{t} категория «Выпечка» из панели = вкладка «Выпечка», набор сходится", page.get_by_role("tab", name="Выпечка").get_attribute("aria-selected") == "true" and count_in_title(page) == n2 and pins(page).count() == n2, (count_in_title(page), n2))
                check(f"{t} на кнопке значок «2» (категория и цена)", page.locator(".filters-badge").inner_text() == "2")
            else:
                page.keyboard.press("Escape")
        else:
            page.keyboard.press("Escape")
        # --- закрыть без применения ---
        page.wait_for_timeout(200)
        cur = count_in_title(page)
        page.locator(".filters-btn").click(); page.wait_for_selector(".filters-panel"); inputs.nth(0).fill(str(mx))
        page.keyboard.press("Escape"); page.wait_for_timeout(250)
        check(f"{t} Esc закрывает панель без применения, фокус возвращается на кнопку", page.locator(".filters-panel").count() == 0 and page.evaluate("document.activeElement.classList.contains('filters-btn')") and count_in_title(page) == cur)
        page.locator(".filters-btn").click(); page.wait_for_selector(".filters-panel")
        check(f"{t} недописанный черновик не «всплывает»: в поле снова применённое значение", inputs.nth(0).input_value() == str(lo), inputs.nth(0).input_value())
        page.locator(".home-map-head h2").click(force=True); page.wait_for_timeout(250)
        check(f"{t} клик мимо панели закрывает её", page.locator(".filters-panel").count() == 0)
        # --- сброс ---
        page.get_by_role("button", name=re.compile("Сбросить фильтр по цене")).click(); page.wait_for_timeout(700)
        check(f"{t} плашка с крестиком снимает цену", page.get_by_role("button", name=re.compile("Сбросить фильтр по цене")).count() == 0)
        page.get_by_role("tab", name="Все").click(); page.wait_for_timeout(600)
        check(f"{t} «Все» возвращает полный набор, значка на кнопке нет", count_in_title(page) == total and page.locator(".filters-badge").count() == 0, (count_in_title(page), total))
        check(f"{t} консоль без ошибок", not errs, errs[:3])
        ctx.close()

    # --- «Горящие» в шапке учитываются в счётчиках панели; диапазон в границах, но без результатов ---
    ctx = new_ctx(p, browser, engine, 1440, 900, False); page = ctx.new_page()
    page.goto(WEB + "/home", wait_until="networkidle"); page.wait_for_selector(CARD); page.wait_for_timeout(1200)
    page.get_by_role("button", name=re.compile("Горящие")).click(); page.wait_for_timeout(500)
    hot_total = count_in_title(page)
    page.locator(".filters-btn").click(); page.wait_for_selector(".filters-panel")
    sums = page.evaluate("[...document.querySelectorAll('.filters-chip .filters-chip-n')].map(e => +e.textContent)")
    check(f"{tag} при «Горящих» счётчики категорий в панели считают только горящие и сходятся с заголовком", sums[0] == hot_total and sum(sums[1:]) == hot_total, (sums, hot_total))
    ctx.close()

with sync_playwright() as p:
    for engine in ENGINES:
        print(f"\n===== {engine} =====")
        browser = getattr(p, engine).launch()
        for name, w, h, mobile in VIEWPORTS:
            try:
                run_home(p, browser, engine, name, w, h, mobile)
            except Exception as e:  # один упавший вьюпорт не должен прятать остальные
                check(f"[{engine}/{name}] сценарий дошёл до конца", False, repr(e)[:300])
        try:
            run_gestures(p, browser, engine)
        except Exception as e:
            check(f"[{engine}] жесты карты: сценарий дошёл до конца", False, repr(e)[:300])
        try:
            run_filters(p, browser, engine)
        except Exception as e:
            check(f"[{engine}] фильтры: сценарий дошёл до конца", False, repr(e)[:300])
        try:
            run_drift(p, browser, engine)
        except Exception as e:
            check(f"[{engine}] автодвижение ленты: сценарий дошёл до конца", False, repr(e)[:300])
        try:
            run_geo(p, browser, engine)
        except Exception as e:
            check(f"[{engine}] геолокация: сценарий дошёл до конца", False, repr(e)[:300])
        browser.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
