"""QA галереи элементов (/ui-lab): элементы по мотивам 21st.dev, уже подключённые в приложении — переключатель, радио-карточки, бейджи статусов, пустые/офлайн
состояния, скелетоны, шторка со свайпом. Без API и без входа (экран доступен в dev-сборке без авторизации).
Запуск: python3 qa/qa_mobile_lab.py (нужен mobile-web на :8081). Скриншоты — в QA_OUT."""
import os, re, sys, tempfile
from playwright.sync_api import sync_playwright

BASE = os.environ.get("MOBILE_URL", "http://localhost:8081")
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())
results = []
def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))
PH = {"width": 390, "height": 844}

def open_lab(b, vp=PH, scheme="light", reduced=False):
    ctx = b.new_context(viewport=vp, color_scheme=scheme, locale="ru-RU", reduced_motion="reduce" if reduced else "no-preference")
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    page.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" and not re.search("vibrate|collapsable|transform-origin|Failed to load resource|non-boolean|Invalid DOM", m.text) else None)
    page.goto(BASE + "/ui-lab", wait_until="networkidle"); page.wait_for_timeout(1500)
    return ctx, page, errs

def axe_ok(page, label):
    try:
        from axe_playwright_python.sync_playwright import Axe
    except ImportError:
        print("[SKIP] axe-playwright-python не установлен"); return
    bad = [(v["id"], [n["target"][0] for n in v["nodes"][:2]]) for v in Axe().run(page, options={"runOnly": {"type": "tag", "values": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]}}).response["violations"]]
    check(f"axe: {label} — 0 нарушений WCAG AA", not bad, bad)

def overflow(page): return page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
def group(page, name): return page.get_by_role("radiogroup", name=name, exact=True)
def box(loc): return loc.bounding_box()

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ───────── загрузка и общий вид ─────────
    ctx, page, errs = open_lab(b); T = page.inner_text("body")
    check("галерея открывается без входа и без API", "ГАЛЕРЕЯ ЭЛЕМЕНТОВ" in T and "Элементы интерфейса" in T, T[:120])
    check("шесть разделов на месте", all(x in T for x in ["Сегментный переключатель", "Способ оплаты", "Статус заказа", "Пустые и офлайн-состояния", "Загрузка списка", "Шторка со свайпом"]))
    check("без горизонтальной прокрутки (390)", not overflow(page))

    # ───────── скользящий переключатель ─────────
    seg = group(page, "Время самовывоза")
    first = seg.get_by_role("radio", name="Сейчас"); second = seg.get_by_role("radio", name="Вечерние")
    check("переключатель: три сегмента-радио, выбран «Сейчас»", seg.get_by_role("radio").count() == 3 and first.get_attribute("aria-checked") == "true")
    check("переключатель: касание сегмента ≥ 44 px", all(box(r)["height"] >= 44 for r in seg.get_by_role("radio").all()))
    second.click(); page.wait_for_timeout(700)
    check("переключатель: «Вечерние» выбран, «Сейчас» — нет", second.get_attribute("aria-checked") == "true" and first.get_attribute("aria-checked") == "false")
    # плашка — единственный непрозрачный блок внутри группы вне сегментов; найдём по геометрии: она должна лежать под выбранным
    thumb_x = page.evaluate("""() => { const g = [...document.querySelectorAll('[role=radiogroup]')].find(e => e.getAttribute('aria-label') === 'Время самовывоза'); const radios = [...g.querySelectorAll('[role=radio]')]; const sel = radios.find(r => r.getAttribute('aria-checked') === 'true').getBoundingClientRect(); const kids = [...g.children].filter(c => c.getAttribute('role') !== 'radio'); const t = kids[0] ? kids[0].getBoundingClientRect() : null; return t ? { thumbLeft: t.left, thumbW: t.width, selLeft: sel.left, selW: sel.width } : null }""")
    check("переключатель: стеклянная плашка встала под выбранный сегмент (по X и ширине)", thumb_x and abs(thumb_x["thumbLeft"] - thumb_x["selLeft"]) < 2 and abs(thumb_x["thumbW"] - thumb_x["selW"]) < 2, thumb_x)
    page.screenshot(path=os.path.join(OUT, "lab_light_top.png"))

    # ───────── радио-карточки ─────────
    pay = group(page, "Способ оплаты")
    cards = pay.get_by_role("radio")
    check("радио-карточки: две карточки, выбрана «Банковская карта», подпись с описанием", cards.count() == 2 and pay.get_by_role("radio", name=re.compile("^Банковская карта. Visa")).get_attribute("aria-checked") == "true")
    pay.scroll_into_view_if_needed(); page.wait_for_timeout(300)
    pane = lambda: page.evaluate("""() => { const g = [...document.querySelectorAll('[role=radiogroup]')].find(e => e.getAttribute('aria-label') === 'Способ оплаты'); const radios = [...g.querySelectorAll('[role=radio]')]; const sel = radios.find(r => r.getAttribute('aria-checked') === 'true').getBoundingClientRect(); const ov = [...g.children].find(c => c.getAttribute('role') !== 'radio'); const o = ov ? ov.getBoundingClientRect() : null; return o ? { dTop: Math.abs(o.top - sel.top), dH: Math.abs(o.height - sel.height) } : null }""")
    pn = pane(); check("радио-карточки: плашка лежит ровно на выбранной карточке", pn and pn["dTop"] < 2 and pn["dH"] < 2, pn)
    pay.get_by_role("radio", name=re.compile("^СБП")).click(); page.wait_for_timeout(120)
    mid = pane()
    page.wait_for_timeout(700); end = pane()
    check("радио-карточки: после выбора СБП плашка переехала на «СБП»", end and end["dTop"] < 2 and end["dH"] < 2, end)
    check("радио-карточки: переезд плавный, а не скачок (в середине пути плашка ещё не на месте)", mid and mid["dTop"] > 2, mid)
    check("радио-карточки: состояние в DOM (aria-checked) переключилось", pay.get_by_role("radio", name=re.compile("^СБП")).get_attribute("aria-checked") == "true" and pay.get_by_role("radio", name=re.compile("^Банковская карта")).get_attribute("aria-checked") == "false")
    page.screenshot(path=os.path.join(OUT, "lab_light_radio.png"))

    # ───────── бейджи, пустые состояния, скелетон ─────────
    T = page.inner_text("body")
    check("бейджи: все четыре статуса", all(x in T for x in ["Ожидает самовывоза", "Забран", "Отменён", "Просрочен"]))
    check("пустые состояния: «Заказов пока нет» с пояснением и действием «Смотреть предложения»", "Заказов пока нет" in T and "Найдите предложение рядом" in T and page.get_by_role("button", name="Смотреть предложения").count() == 1)
    check("офлайн-состояние: «Нет соединения» и «Повторить»", "Нет соединения" in T and page.get_by_role("button", name="Повторить").count() >= 1)
    check("скелетон: одна подпись «Загрузка» для скринридера", page.get_by_role("progressbar", name="Загрузка...").count() == 1)
    page.get_by_role("button", name="Показать, что загрузилось").click(); page.wait_for_timeout(300)
    check("скелетон: после «загрузилось» заглушек нет", page.get_by_role("progressbar").count() == 0 and "Загрузка закончилась" in page.inner_text("body"))
    page.get_by_role("button", name="Снова показать загрузку").click(); page.wait_for_timeout(300)
    check("скелетон: можно показать снова", page.get_by_role("progressbar", name="Загрузка...").count() == 1)

    # ───────── шторка со свайпом ─────────
    page.get_by_role("button", name="Открыть шторку").click(); page.wait_for_timeout(700)
    check("шторка: открылась, тема обращения — радио-карточки", page.get_by_role("radiogroup", name="Тема обращения").count() == 1 and page.get_by_role("radio", name="Не могу забрать заказ").get_attribute("aria-checked") == "true")
    page.get_by_role("radio", name="Списана не та сумма").click(); page.wait_for_timeout(500)
    check("шторка: выбор темы работает", page.get_by_role("radio", name="Списана не та сумма").get_attribute("aria-checked") == "true")
    grab = page.get_by_role("radiogroup", name="Тема обращения").evaluate("e => { let n = e; while (n && !n.querySelector('[style*=\"grab\"]')) n = n.parentElement; const g = n && n.querySelector('[style*=\"grab\"]'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height } }")
    check("шторка: «ручка» — зона касания ≥ 28 px высотой", grab["h"] >= 28, grab)
    page.screenshot(path=os.path.join(OUT, "lab_light_sheet.png"))
    # короткий медленный свайп → возвращается
    page.mouse.move(grab["x"], grab["y"]); page.mouse.down(); page.mouse.move(grab["x"], grab["y"] + 30, steps=6); page.wait_for_timeout(150)
    mid_y = page.get_by_role("radiogroup", name="Тема обращения").bounding_box()["y"]
    page.mouse.up(); page.wait_for_timeout(700)
    check("свайп: короткое протаскивание — шторка идёт за пальцем и возвращается на место", page.get_by_role("radiogroup", name="Тема обращения").count() == 1, mid_y)
    # длинный свайп → закрывается
    g2 = page.get_by_role("radiogroup", name="Тема обращения").evaluate("e => { let n = e; while (n && !n.querySelector('[style*=\"grab\"]')) n = n.parentElement; const g = n.querySelector('[style*=\"grab\"]'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }")
    page.mouse.move(g2["x"], g2["y"]); page.mouse.down(); page.mouse.move(g2["x"], g2["y"] + 160, steps=12); page.mouse.up(); page.wait_for_timeout(900)
    check("свайп: протащили дальше порога — шторка закрылась", page.get_by_role("radiogroup", name="Тема обращения").count() == 0)
    page.get_by_role("button", name="Открыть шторку").click(); page.wait_for_timeout(700)
    check("шторка: при повторном открытии снова на месте (не «улетела» после свайпа)", page.get_by_role("radiogroup", name="Тема обращения").is_visible() and page.get_by_role("radiogroup", name="Тема обращения").bounding_box()["y"] < 844)
    page.keyboard.press("Escape"); page.wait_for_timeout(600)
    check("шторка: Esc закрывает", page.get_by_role("radiogroup", name="Тема обращения").count() == 0)
    check("консоль без ошибок (светлая)", not errs, errs[:3])
    axe_ok(page, "UI Lab (светлая)")
    ctx.close()

    # ───────── тёмная тема ─────────
    ctx, page, errs = open_lab(b, scheme="dark")
    page.screenshot(path=os.path.join(OUT, "lab_dark_top.png"))
    group(page, "Способ оплаты").scroll_into_view_if_needed(); page.wait_for_timeout(300)
    page.get_by_role("radio", name=re.compile("^СБП")).last.click(); page.wait_for_timeout(700)
    page.screenshot(path=os.path.join(OUT, "lab_dark_radio.png"))
    page.get_by_role("button", name="Смотреть предложения").scroll_into_view_if_needed(); page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(OUT, "lab_dark_states.png"))
    page.get_by_role("button", name="Открыть шторку").scroll_into_view_if_needed(); page.get_by_role("button", name="Открыть шторку").click(); page.wait_for_timeout(700)
    page.screenshot(path=os.path.join(OUT, "lab_dark_sheet.png"))
    axe_ok(page, "UI Lab с открытой шторкой (тёмная)")
    page.keyboard.press("Escape"); page.wait_for_timeout(500)
    axe_ok(page, "UI Lab (тёмная)")
    check("консоль без ошибок (тёмная)", not errs, errs[:3])
    ctx.close()

    # переключатель темы показывает фактическую тему и переключает её
    ctx, page, errs = open_lab(b, scheme="dark")
    tg = group(page, "Тема оформления")
    check("тема: в тёмной системной теме выбрана «Тёмная»", tg.get_by_role("radio", name="Тёмная").get_attribute("aria-checked") == "true")
    bg = lambda: page.evaluate("getComputedStyle(document.body).backgroundColor + '|' + getComputedStyle(document.querySelector('[role=radiogroup]')).color")
    radios = tg.get_by_role("radio")
    check("тема: переключатель только со значками — в сегментах svg, видимого текста нет", radios.count() == 2 and all(r.locator("svg").count() == 1 and r.inner_text().strip() == "" for r in radios.all()))
    sizes = [box(r) for r in radios.all()]
    check("тема: сегменты по 52×44 px (касание ≥ 44), переключатель компактный (≤ 120 px)", all(abs(s_["width"] - 52) < 1.5 and s_["height"] >= 44 for s_ in sizes) and box(tg)["width"] <= 120, (sizes, box(tg)))
    tg.get_by_role("radio", name="Светлая").click(); page.wait_for_timeout(500)
    check("тема: нажатие «Светлая» переключает тему, выбор виден", tg.get_by_role("radio", name="Светлая").get_attribute("aria-checked") == "true" and tg.get_by_role("radio", name="Тёмная").get_attribute("aria-checked") == "false")
    page.screenshot(path=os.path.join(OUT, "lab_toggled_light.png"))
    ctx.close()

    # ───────── переключатель темы со значками: глубокая проверка ─────────
    ctx, page, errs = open_lab(b, scheme="light")
    tg = group(page, "Тема оформления"); sun = tg.get_by_role("radio", name="Светлая"); moon = tg.get_by_role("radio", name="Тёмная")
    thumb_geo = lambda: page.evaluate("""() => { const g = [...document.querySelectorAll('[role=radiogroup]')].find(e => e.getAttribute('aria-label') === 'Тема оформления'); const sel = [...g.querySelectorAll('[role=radio]')].find(r => r.getAttribute('aria-checked') === 'true').getBoundingClientRect(); const t = [...g.children].find(c => c.getAttribute('role') !== 'radio').getBoundingClientRect(); return { dx: Math.abs(t.left - sel.left), dw: Math.abs(t.width - sel.width) } }""")
    page_bg = lambda: page.evaluate("getComputedStyle(document.querySelector('[data-testid]') || document.body).backgroundColor")
    check("тема-значки: в светлой теме выбрано солнце, плашка под ним", sun.get_attribute("aria-checked") == "true" and thumb_geo()["dx"] < 2)
    # клавиатура: Tab до переключателя и Enter/Space
    sun.focus(); page.keyboard.press("Tab"); page.wait_for_timeout(100)
    focused = page.evaluate("document.activeElement && document.activeElement.getAttribute('aria-label')")
    check("тема-значки: до луны можно дойти клавишей Tab (фокус на «Тёмная»)", focused == "Тёмная", focused)
    page.keyboard.press("Enter"); page.wait_for_timeout(600)
    check("тема-значки: Enter на луне включает тёмную тему", moon.get_attribute("aria-checked") == "true" and sun.get_attribute("aria-checked") == "false")
    g = thumb_geo(); check("тема-значки: после смены темы плашка осталась под луной (раскладка не поехала)", g["dx"] < 2 and g["dw"] < 2, g)
    check("тема-значки: фактически стала тёмная (фон страницы тёмный)", page.evaluate("(() => { const c = getComputedStyle(document.body).backgroundColor.match(/\\d+/g).map(Number); return (c[0] + c[1] + c[2]) / 3 < 80 })()") or page.evaluate("document.documentElement.outerHTML.includes('rgb(11, 17, 16)')"))
    # быстрые нажатия: итоговое состояние согласовано
    for _ in range(3):
        sun.click(); moon.click()
    page.wait_for_timeout(800)
    g = thumb_geo()
    check("тема-значки: серия быстрых нажатий — выбрана одна «Тёмная», плашка под ней", moon.get_attribute("aria-checked") == "true" and sun.get_attribute("aria-checked") == "false" and g["dx"] < 2, g)
    sun.click(); sun.click(); page.wait_for_timeout(600)
    check("тема-значки: повторное нажатие на выбранное ничего не ломает", sun.get_attribute("aria-checked") == "true" and thumb_geo()["dx"] < 2)
    # запоминание: тёмная -> перезагрузка -> тёмная и луна выбрана
    moon.click(); page.wait_for_timeout(500)
    saved = page.evaluate("localStorage.getItem('apetite.themeModeOverride')")
    page.reload(wait_until="networkidle"); page.wait_for_timeout(1800)
    tg = group(page, "Тема оформления")
    check("тема-значки: выбор запомнился (apetite.themeModeOverride=dark) и после перезагрузки выбрана луна", saved == "dark" and tg.get_by_role("radio", name="Тёмная").get_attribute("aria-checked") == "true" and thumb_geo()["dx"] < 2, saved)
    page.screenshot(path=os.path.join(OUT, "lab_theme_icons_dark.png"))
    axe_ok(page, "переключатель темы со значками (после перезагрузки, тёмная)")
    ctx.close()
    # узкий экран и reduced motion
    ctx, page, errs = open_lab(b, {"width": 320, "height": 568}, "light")
    tg = group(page, "Тема оформления")
    check("тема-значки: на 320 px влезает целиком и не вылезает за экран", box(tg)["x"] >= 0 and box(tg)["x"] + box(tg)["width"] <= 320 and not overflow(page), box(tg))
    ctx.close()
    ctx, page, errs = open_lab(b, reduced=True, scheme="light")
    tg = group(page, "Тема оформления"); tg.get_by_role("radio", name="Тёмная").click(); page.wait_for_timeout(60)
    check("тема-значки + reduced motion: плашка встаёт сразу без «поездки»", thumb_geo()["dx"] < 2, thumb_geo())
    ctx.close()

    # ───────── размеры и reduced motion ─────────
    for name, vp in (("320×568", {"width": 320, "height": 568}), ("планшет/веб 1000×920", {"width": 1000, "height": 920})):
        ctx, page, errs = open_lab(b, vp, "dark")
        check(f"{name}: без горизонтальной прокрутки", not overflow(page))
        page.screenshot(path=os.path.join(OUT, f"lab_{'small' if '320' in name else 'wide'}.png"))
        ctx.close()
    ctx, page, errs = open_lab(b, reduced=True)
    group(page, "Способ оплаты").scroll_into_view_if_needed()
    page.get_by_role("radio", name=re.compile("^СБП")).last.click(); page.wait_for_timeout(60)
    r = page.evaluate("""() => { const g = [...document.querySelectorAll('[role=radiogroup]')].find(e => e.getAttribute('aria-label') === 'Способ оплаты'); const radios = [...g.querySelectorAll('[role=radio]')]; const sel = radios.find(r => r.getAttribute('aria-checked') === 'true').getBoundingClientRect(); const ov = [...g.children].find(c => c.getAttribute('role') !== 'radio').getBoundingClientRect(); return Math.abs(ov.top - sel.top) }""")
    check("reduced motion: плашка встаёт сразу, без «поездки»", r < 2, r)
    ctx.close()
    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
