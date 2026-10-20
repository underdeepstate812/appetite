"""QA заставки и приветственной страницы мобильного web-приложения на ЗАМОКАННОМ API: сеть и пароли не нужны.
Заставка (прелоадер со знаком) → приветствие (арт-карта, заголовок, «Войти» / «Создать аккаунт» с пульсацией) → вход/регистрация.
Запуск: python3 qa/qa_mobile_welcome.py (нужен mobile-web на :8081). Скриншоты — в QA_OUT."""
import json, os, re, sys, tempfile
from playwright.sync_api import sync_playwright

BASE = os.environ.get("MOBILE_URL", "http://localhost:8081")
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())
results = []

def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))

def install_api(ctx):
    def handler(route, request):
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
        path = re.sub(r"^https?://[^/]+/api/v1", "", request.url).split("?")[0]
        body = [] if path == "/offers/nearby" else {"statusCode": 404, "message": "not mocked"}
        route.fulfill(status=200 if path == "/offers/nearby" else 404, content_type="application/json", body=json.dumps(body), headers={"access-control-allow-origin": "*"})
    ctx.route("**/api/v1/**", handler)

def new_page(b, vp=None, scheme="light", reduced=False):
    ctx = b.new_context(viewport=vp or {"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme=scheme,
                        reduced_motion="reduce" if reduced else "no-preference", locale="ru-RU")
    install_api(ctx)
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:160]))
    return ctx, page, errs

def fld(page, label):
    return page.locator(f'input[aria-label="{label}"]:visible')

def open_welcome(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.get_by_role("heading", name=re.compile("Вкусная еда рядом")).wait_for(timeout=30000)

RINGS = "[data-testid='button-pulse']"
SAMPLE_JS = """() => [...document.querySelectorAll("[data-testid='button-pulse']")].map(el => { const r = el.getBoundingClientRect(); return [+getComputedStyle(el).opacity, r.width, r.height] })"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ---------- заставка ----------
    ctx, page, errs = new_page(b)
    page.goto(BASE + "/", wait_until="commit")
    bar = page.get_by_role("progressbar", name="Appetite — Загрузка...")
    bar.wait_for(timeout=15000)
    check("заставка: есть прогресс-индикатор с именем бренда для скринридера", bar.count() == 1)
    box = bar.bounding_box(); vp = page.viewport_size
    check("заставка: закрывает весь экран", box and box["width"] >= vp["width"] - 1 and box["height"] >= vp["height"] - 1, box)
    bg = bar.evaluate("e => getComputedStyle(e).backgroundColor")
    check("заставка: фон совпадает с нативной (#052e2b)", bg == "rgb(5, 46, 43)", bg)
    mark_visible = page.evaluate("() => [...document.querySelectorAll('svg')].some(s => { const r = s.getBoundingClientRect(); return r.width > 40 && r.height > 40 && s.querySelector('path') })")
    check("заставка: знак Appetite нарисован", mark_visible)
    page.screenshot(path=os.path.join(OUT, "welcome_boot.png"))
    page.get_by_role("heading", name=re.compile("Вкусная еда рядом")).wait_for(timeout=30000)
    try:
        page.get_by_role("progressbar", name="Appetite — Загрузка...").wait_for(state="detached", timeout=8000)
        gone = True
    except Exception:
        gone = False
    check("заставка уходит сама (не позже ~2 с) и не остаётся в дереве", gone)
    check("после заставки нет JS-ошибок", not errs, errs[:2]); ctx.close()

    ctx, page, errs = new_page(b, reduced=True)
    page.goto(BASE + "/", wait_until="commit")
    page.get_by_role("heading", name=re.compile("Вкусная еда рядом")).wait_for(timeout=30000)
    try:
        page.get_by_role("progressbar", name="Appetite — Загрузка...").wait_for(state="detached", timeout=4000)
        gone = True
    except Exception:
        gone = False
    check("reduce-motion: заставка тоже уходит (быстрее обычной)", gone)
    ctx.close()

    # ---------- приветствие: содержание ----------
    ctx, page, errs = new_page(b); open_welcome(page); page.wait_for_timeout(2500)
    check("заголовок с ember-цифрой читается целиком скринридером", page.get_by_role("heading", name="Вкусная еда рядом — со скидкой до 70%").count() == 1)
    check("подзаголовок: что это и как работает", page.get_by_text(re.compile("Горячие предложения кафе, пекарен и магазинов")).count() == 1)
    check("два действия: «Войти» и «Создать аккаунт»", page.get_by_role("button", name="Войти", exact=True).count() == 1 and page.get_by_role("button", name="Создать аккаунт", exact=True).count() == 1)
    check("метка «Бета · Санкт-Петербург»", page.get_by_text("Бета · Санкт-Петербург").count() == 1)
    art_hidden = page.evaluate("""() => { const t = [...document.querySelectorAll('div,span')].find(e => e.children.length === 0 && e.textContent.trim() === '−70%'); let n = t; while (n) { if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return true; n = n.parentElement } return false }""")
    check("арт-карта (наклейки, изолинии) скрыт от скринридера — смысл несёт заголовок", art_hidden)
    stamps = page.evaluate("() => [...document.querySelectorAll('div')].filter(e => e.children.length === 0 && /^[−-]\\d+%$/.test(e.textContent.trim())).map(e => e.textContent.trim()).filter((v, i, a) => a.indexOf(v) === i).sort()")
    check("на карте три наклейки со скидкой: −40%, −55%, −70%", len(stamps) == 3, stamps)
    big_marks = page.evaluate("() => [...document.querySelectorAll('svg')].filter(s => s.querySelector('path[fill^=\"url(#\"]') && s.getBoundingClientRect().width > 60).length")
    check("в центре карты нет знака-маркера (знак Appetite остаётся только в шапке)", big_marks == 0, big_marks)
    blobs = page.evaluate("() => [...document.querySelectorAll('svg path')].filter(p => { const d = p.getAttribute('d') || ''; return p.getAttribute('fill') === '#2dd4bf' || (d.split('L').length > 40 && p.getAttribute('fill') === 'none') }).length")
    check("никаких абстрактных «клякс»: изолиний-террас нет", blobs == 0, blobs)
    me = page.locator("[data-testid=you-are-here]")
    box = me.first.bounding_box() if me.count() else None
    art = page.evaluate("() => { const r = document.querySelector('[data-testid=you-are-here]'); const a = r && r.closest('[aria-hidden=true]'); const b = a && a.getBoundingClientRect(); return b ? [b.left + b.width / 2, b.top + b.height / 2] : null }")
    check("точка «вы здесь» — в самом центре карты", box is not None and art is not None and abs(box["x"] + box["width"] / 2 - art[0]) < 3 and abs(box["y"] + box["height"] / 2 - art[1]) < 3, (box, art))
    city = page.evaluate("""() => { const t = [...document.querySelectorAll('svg text')].map(e => e.textContent.trim());
      const paths = [...document.querySelectorAll('svg path')];
      return { labels: t, river: paths.filter(p => p.getAttribute('stroke') === '#1b7a88').length, parks: paths.filter(p => p.getAttribute('fill') === '#3fae82').length,
               blocks: paths.filter(p => p.getAttribute('fill') === '#ffffff' && (p.getAttribute('d') || '').split('M').length > 20).length, landmarks: paths.filter(p => p.getAttribute('fill') === '#9ff3e6' && (p.getAttribute('d') || '').includes('M')).length,
               route: paths.filter(p => p.getAttribute('stroke') === '#ff8a3d' && p.getAttribute('stroke-dasharray')).length,
               pins: [...document.querySelectorAll('svg circle')].filter(c => ['#5eead4', '#ff8a3d', '#fbbf24'].includes(c.getAttribute('fill')) && +c.getAttribute('r') < 1.2).length } }""")
    check("карта города: подписи «НЕВА», «Невский пр.», «Фонтанка», «Летний сад»", all(x in city["labels"] for x in ("НЕВА", "Невский пр.", "Фонтанка", "Летний сад")), city["labels"])
    check("карта города: река с каналами, парки, кварталы двух плотностей и выделенные ориентиры", city["river"] >= 3 and city["parks"] >= 3 and city["blocks"] >= 2 and city["landmarks"] >= 1, city)
    check("карта города: пунктирный маршрут от знака к скидке и метки предложений на улицах", city["route"] >= 1 and city["pins"] >= 8, city)
    fonts = page.evaluate("() => [...document.querySelectorAll('svg text')].map(e => getComputedStyle(e).fontFamily)")
    check("подписи на карте — гротеском, а не засечками по умолчанию", fonts and all("serif" not in f.replace("sans-serif", "") for f in fonts), fonts[:1])
    ids = page.evaluate("(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id); return ids.length-new Set(ids).size})()")
    check("в документе нет дублирующихся id (градиенты арта и фона не конфликтуют)", ids == 0, ids)
    page.screenshot(path=os.path.join(OUT, "welcome_light.png")); ctx.close()

    # ---------- пульсация кнопок ----------
    ctx, page, errs = new_page(b); open_welcome(page); page.wait_for_timeout(2200)
    rings = page.locator(RINGS)
    check("пульсирующих колец два: по одному на кнопку", rings.count() == 2, rings.count())
    props = page.evaluate("""() => [...document.querySelectorAll("[data-testid='button-pulse']")].map(e => [getComputedStyle(e).pointerEvents, e.closest("[aria-hidden='true']") !== null || e.getAttribute('aria-hidden') === 'true'])""")
    check("кольца не ловят касания и скрыты от скринридера", props and all(pe == "none" and hidden for pe, hidden in props), props)
    samples = []
    for i in range(80):
        samples.append(page.evaluate(SAMPLE_JS)); page.wait_for_timeout(40)
    peak = [max(range(len(samples)), key=lambda k: samples[k][j][0]) for j in (0, 1)]
    peak_op = [max(s[j][0] for s in samples) for j in (0, 1)]
    check("кольцо главной кнопки заметно (прозрачность в пике ≥ 0.3), второй — тише, но видно (≥ 0.15)", peak_op[0] >= 0.3 and peak_op[1] >= 0.15 and peak_op[0] > peak_op[1], peak_op)
    check("между ударами есть пауза (кольцо гаснет до нуля)", all(min(s[j][0] for s in samples) < 0.02 for j in (0, 1)))
    check("кнопки бьются по очереди, а не хором (пики разнесены ≥ 0,6 с)", abs(peak[0] - peak[1]) * 0.04 >= 0.6, peak)
    btn = page.get_by_role("button", name="Войти", exact=True).bounding_box()
    grown = max(s[0][1] for s in samples) - btn["width"]
    check("кольцо выходит за край кнопки на ≥ 12 px по ширине (по 6+ с каждой стороны)", grown >= 12, round(grown, 1))
    names = [e.get_attribute("aria-label") or e.inner_text() for e in page.get_by_role("button").all()]
    check("пульсация не меняет имена кнопок для скринридера", names == ["Войти", "Создать аккаунт"], names)
    # касание по кнопке в момент пульса попадает в кнопку, а не в кольцо
    page.get_by_role("button", name="Войти", exact=True).click(); fld(page, "Пароль").wait_for(timeout=10000)
    check("«Войти» открывает форму входа", fld(page, "Email").count() == 1)
    ctx.close()

    ctx, page, errs = new_page(b, reduced=True); open_welcome(page); page.wait_for_timeout(1500)
    check("reduce-motion: кольца не рисуются, кнопки статичны", page.locator(RINGS).count() == 0)
    check("reduce-motion: арт на месте и читается", page.get_by_role("button", name="Войти", exact=True).count() == 1)
    ctx.close()

    # ---------- навигация ----------
    ctx, page, errs = new_page(b); open_welcome(page)
    page.get_by_role("button", name="Создать аккаунт", exact=True).click(); fld(page, "Имя").wait_for(timeout=10000)
    check("«Создать аккаунт» открывает регистрацию", fld(page, "Имя").count() == 1 and fld(page, "Пароль").count() >= 1)
    back = page.get_by_role("button", name=re.compile("Назад"))
    check("на регистрации есть «Назад»", back.count() >= 1)
    back.first.click(); page.wait_for_timeout(700)
    check("«Назад» возвращает на приветствие", page.get_by_role("heading", name=re.compile("Вкусная еда рядом")).is_visible() and page.get_by_role("button", name="Создать аккаунт", exact=True).is_visible())
    page.get_by_role("button", name="Войти", exact=True).click(); fld(page, "Email").wait_for(timeout=10000)
    page.get_by_role("button", name=re.compile("Назад")).first.click(); page.wait_for_timeout(700)
    check("со входа «Назад» тоже ведёт на приветствие", page.get_by_role("heading", name=re.compile("Вкусная еда рядом")).is_visible())
    check("нет JS-ошибок при переходах", not errs, errs[:2]); ctx.close()

    # ---------- раскладка на разных экранах ----------
    for scheme in ("light", "dark"):
        for name, vp in (("320×568", {"width": 320, "height": 568}), ("375×667", {"width": 375, "height": 667}), ("390×844", {"width": 390, "height": 844}),
                         ("402×874", {"width": 402, "height": 874}), ("430×932", {"width": 430, "height": 932}), ("768×1024", {"width": 768, "height": 1024})):
            ctx, page, errs = new_page(b, vp, scheme); open_welcome(page); page.wait_for_timeout(1800)
            overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
            signin = page.get_by_role("button", name="Войти", exact=True).bounding_box(); create = page.get_by_role("button", name="Создать аккаунт", exact=True).bounding_box()
            inside = signin and create and create["y"] + create["height"] <= vp["height"] + 1 and signin["x"] >= 0 and signin["x"] + signin["width"] <= vp["width"] + 0.5
            tall = signin and create and signin["height"] >= 44 and create["height"] >= 44
            gap = create["y"] - (signin["y"] + signin["height"]) if signin and create else 0
            head = page.get_by_role("heading", name=re.compile("Вкусная еда рядом")).bounding_box()
            clear = head and signin and head["y"] + head["height"] <= signin["y"] + 1
            check(f"{scheme} / {name}: без прокрутки вбок, обе кнопки на первом экране, ≥ 44 px, заголовок не налезает на кнопки", not overflow and inside and tall and clear, (overflow, signin, create, head))
            check(f"{scheme} / {name}: между кнопками ≥ 8 px", gap >= 8, gap)
            if scheme == "dark" and name in ("320×568", "402×874"): page.screenshot(path=os.path.join(OUT, f"welcome_dark_{name.replace('×', 'x')}.png"))
            ctx.close()

    # ---------- одинаковая «тёмная сцена» в обеих темах ----------
    bgs = []
    for scheme in ("light", "dark"):
        ctx, page, errs = new_page(b, scheme=scheme); open_welcome(page); page.wait_for_timeout(1200)
        bgs.append(page.evaluate("() => { const h = [...document.querySelectorAll('div')].find(e => getComputedStyle(e).backgroundColor === 'rgb(5, 46, 43)'); return !!h }")); ctx.close()
    check("страница приветствия — одна и та же тёмная сцена (#052e2b) в светлой и тёмной теме", all(bgs), bgs)

    # ---------- доступность ----------
    try:
        from axe_playwright_python.sync_playwright import Axe
        axe = Axe(); tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
        def axe_violations(page): return [v["id"] for v in axe.run(page, options={"runOnly": {"type": "tag", "values": tags}}).response["violations"]]
        for scheme in ("light", "dark"):
            ctx, page, errs = new_page(b, scheme=scheme, reduced=True); open_welcome(page); page.wait_for_timeout(1200)
            bad = axe_violations(page)
            check(f"axe ({scheme}): приветствие — 0 нарушений WCAG AA (контраст ≥ 4.5:1 на тёмной сцене)", not bad, bad); ctx.close()
    except ImportError:
        print("[SKIP] axe-playwright-python не установлен — a11y-аудит пропущен")

    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
