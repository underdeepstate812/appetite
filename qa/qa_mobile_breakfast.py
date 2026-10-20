"""QA вкладки «Завтрак» на «Сейчас» и подсказки о скидке на экране оффера — мобильное web-приложение на ЗАМОКАННОМ API.
Вкладка живёт до 10:00 по Москве (граница «10:00» уже без неё), показывает предложения, самовывоз которых заканчивается
сегодня не позже 10:00, и сама пропадает при открытом приложении. Время сдвигается init-скриптом (часы идут).
Запуск: python3 qa/qa_mobile_breakfast.py (нужен mobile-web на :8081)."""
import json, os, re, sys, tempfile
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright

QA = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(QA, "qa_mobile_orders.py")).read().split("\nwith sync_playwright() as p:")[0])  # make_state, install_api, tab, check …
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())

D = datetime(2026, 10, 20, tzinfo=timezone.utc)  # вторник
def msk(h, m=0, s=0, days=0):
    """Московское «стенное» время дня D → UTC datetime (МСК = UTC+3 круглый год)."""
    return D + timedelta(days=days, hours=h - 3, minutes=m, seconds=s)
iso_dt = lambda dt: dt.isoformat().replace("+00:00", "Z")

def mk_offer(i, title, start, end, disc=50, mode="DYNAMIC", price=20000, **kw):
    return {"id": f"b-{i}", "businessId": f"biz-{i}", "title": title, "description": None, "category": "BAKERY", "originalPrice": price * 100 // (100 - disc),
            "discountedPrice": price, "discountPercent": disc, "baseDiscountPercent": disc, "discountMode": mode, "imageUrl": None, "quantityTotal": 6, "quantityLeft": 6, "weightKg": 0.4,
            "pickupStart": iso_dt(start), "pickupEnd": iso_dt(end), "status": "ACTIVE", "featured": False, "createdAt": iso_dt(msk(0)), "updatedAt": iso_dt(msk(0)),
            "businessName": f"Пекарня {i}", "businessAddress": "Невский 1", "businessLat": 59.93, "businessLng": 30.36, "businessLogoUrl": None, "distanceKm": 0.5 + i / 10,
            "ingredients": "Мука, вода", "allergens": ["gluten"], "allergensDeclared": True, "bestBefore": iso_dt(end + timedelta(hours=6)), **kw}

OFFERS = [
    mk_offer(1, "Круассан и кофе", msk(7), msk(9, 30), 50),                       # завтрак, уже открыт в 08:00
    mk_offer(2, "Сырники с ягодами", msk(8, 30), msk(10, 0), 45),                 # завтрак: закрывается ровно в 10:00 (граница включена), откроется позже
    mk_offer(3, "Бизнес-ланч", msk(7), msk(12, 0), 40),                           # окно до 12:00 — не завтрак
    mk_offer(4, "Ужин из пекарни", msk(17), msk(20, 0), 55),                      # вечерний
    mk_offer(5, "Багет вчерашний", msk(6), msk(9, 0, days=1), 35),                # закончится завтра утром — сегодня не завтрак
    mk_offer(6, "Овсянка фиксированная", msk(7), msk(9, 45), 40, mode="FIXED"),   # завтрак, скидка фиксирована
]
TITLES = lambda page: [b.get_attribute("aria-label").split(",")[0] for b in page.locator("[role=button]:not([data-testid=offer-ribbon] [role=button])").filter(has_text="₽").all() if b.get_attribute("aria-label")] or \
    [t for t in page.evaluate("() => [...document.querySelectorAll('[role=button]')].filter(e => !e.closest('[data-testid=offer-ribbon]') && e.innerText.includes('₽') && e.getBoundingClientRect().width > 0).map(e => e.innerText.split('\\n').filter(l => l.length > 5 && !l.includes('₽') && !l.includes('км') && !/^[−-]\\d+%$/.test(l))[0])")]

def open_home(b, at, offers=OFFERS, scheme="dark", vp=None):
    ctx = b.new_context(viewport=vp or {"width": 390, "height": 844}, color_scheme=scheme, locale="ru-RU", geolocation={"latitude": 59.9311, "longitude": 30.3609}, permissions=["geolocation"])
    utc_ms = int(at.timestamp() * 1000)
    ctx.add_init_script("localStorage.setItem('apetite.accessToken','fake.a.b'); localStorage.setItem('apetite.refreshToken','fake.r.b');")
    ctx.add_init_script("""(() => { const T = %d; const off = T - Date.now(); const R = Date; class F extends R { constructor(...a) { if (a.length === 0) super(R.now() + off); else super(...a); } static now() { return R.now() + off; } } window.Date = F; })()""" % utc_ms)
    st = make_state(); st["offers"] = offers; install_api(ctx, st)
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:160]))
    page.goto(BASE, wait_until="networkidle"); page.wait_for_timeout(2200)
    return ctx, page, errs

LIST = lambda page: page.locator("[role=button]:not([data-testid=offer-ribbon] [role=button])")  # карточки списка: лента над картой едет и не годится для клика
def radios(page): return [r.get_attribute("aria-label") for r in page.get_by_role("radiogroup", name="Время самовывоза").get_by_role("radio").all()]
def select(page, name): page.get_by_role("radiogroup", name="Время самовывоза").get_by_role("radio", name=name).click(); page.wait_for_timeout(900)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ---------- утро: вкладка есть, первая по времени ----------
    ctx, page, errs = open_home(b, msk(8, 0))
    check("08:00 МСК: вкладки «Завтрак», «Сейчас», «Вечерние» — завтрак по времени первый", radios(page) == ["Завтрак", "Сейчас", "Вечерние"], radios(page))
    check("по умолчанию выбрана «Сейчас» (завтрак — по желанию, а не навязан)", page.get_by_role("radio", name="Сейчас").get_attribute("aria-checked") == "true")
    select(page, "Завтрак")
    shown = TITLES(page)
    check("«Завтрак»: предложения, что закрываются сегодня не позже 10:00 (включая ровно 10:00 и ещё не открывшиеся)", sorted(shown) == sorted(["Круассан и кофе", "Сырники с ягодами", "Овсянка фиксированная"]), shown)
    check("«Завтрак»: нет обеда до 12:00, вечернего и окна, что закончится завтра утром", not any(x in shown for x in ("Бизнес-ланч", "Ужин из пекарни", "Багет вчерашний")), shown)
    page.screenshot(path=os.path.join(OUT, "breakfast_0800.png"))
    select(page, "Сейчас")
    now_list = TITLES(page)
    check("«Сейчас» по-прежнему показывает завтрак, который уже можно забрать (вкладка — срез, а не перенос)", "Круассан и кофе" in now_list and "Бизнес-ланч" in now_list and "Сырники с ягодами" not in now_list, now_list)
    select(page, "Вечерние")
    check("«Вечерние»: ещё не открывшиеся (сырники 08:30, ужин 17:00)", "Сырники с ягодами" in TITLES(page) and "Ужин из пекарни" in TITLES(page), TITLES(page))
    check("нет JS-ошибок", not errs, errs[:2]); ctx.close()

    # ---------- граница 10:00 и день ----------
    for hh, mm, ss, want, label in ((9, 59, 0, True, "09:59"), (10, 0, 0, False, "10:00 ровно — вкладки уже нет"), (11, 30, 0, False, "11:30"), (15, 0, 0, False, "15:00"), (0, 5, 0, True, "00:05 ночью — вкладка уже есть"), (3, 0, 0, True, "03:00")):
        ctx, page, errs = open_home(b, msk(hh, mm, ss))
        has = "Завтрак" in radios(page)
        check(f"{label}: вкладка «Завтрак» {'есть' if want else 'скрыта'}", has == want, radios(page))
        if not want: check(f"{label}: остались «Сейчас» и «Вечерние»", radios(page) == ["Сейчас", "Вечерние"], radios(page))
        ctx.close()

    # ---------- пустое утро ----------
    ctx, page, errs = open_home(b, msk(6, 30), offers=[mk_offer(3, "Бизнес-ланч", msk(7), msk(12, 0), 40)])
    check("утром без завтраков вкладка остаётся и объясняет, что пусто", "Завтрак" in radios(page))
    select(page, "Завтрак")
    check("пустая вкладка: понятное сообщение", page.get_by_text("Пока нет предложений на завтрак").count() == 1)
    ctx.close()

    # ---------- вкладка исчезает сама, пока приложение открыто ----------
    ctx, page, errs = open_home(b, msk(9, 59, 20))
    select(page, "Завтрак")
    check("09:59:20: выбран «Завтрак»", page.get_by_role("radio", name="Завтрак").get_attribute("aria-checked") == "true")
    page.wait_for_timeout(45_000)
    check("через 45 с (после 10:00:00) вкладка пропала сама — ровно по границе, а не на следующем «тике»", "Завтрак" not in radios(page), radios(page))
    check("и выбор вернулся на «Сейчас», экран не пустой и не сломан", page.get_by_role("radio", name="Сейчас").get_attribute("aria-checked") == "true" and len(TITLES(page)) >= 1, TITLES(page))
    page.screenshot(path=os.path.join(OUT, "breakfast_after10.png"))
    check("нет JS-ошибок при исчезновении вкладки", not errs, errs[:2]); ctx.close()

    # ---------- подсказка о скидке на экране оффера ----------
    ctx, page, errs = open_home(b, msk(8, 0))
    select(page, "Завтрак")
    LIST(page).filter(has_text="Круассан и кофе").first.click(); page.wait_for_timeout(1800)
    note = page.inner_text("body")
    check("растущая скидка: «Скидка вырастет до 60% около …» (конец в 09:30: +10% за 2 ч → 07:30 уже прошло, +20% за час → 08:30)", re.search(r"Скидка вырастет до 70% около 08:30", note) is not None, note[:400])
    page.get_by_role("button", name="Назад").click(); page.wait_for_timeout(900)
    LIST(page).filter(has_text="Овсянка фиксированная").first.click(); page.wait_for_timeout(1800)
    check("фиксированная скидка: так и написано, роста нет", "Скидка фиксированная — цена до конца самовывоза не изменится" in page.inner_text("body") and "вырастет" not in page.inner_text("body"))
    page.screenshot(path=os.path.join(OUT, "breakfast_offer_fixed.png")); ctx.close()

    # ---------- раскладка и доступность ----------
    for name, vp in (("320×568", {"width": 320, "height": 568}), ("390×844", {"width": 390, "height": 844}), ("768×1024", {"width": 768, "height": 1024})):
        ctx, page, errs = open_home(b, msk(8, 0), vp=vp)
        over = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
        boxes = [r.bounding_box() for r in page.get_by_role("radiogroup", name="Время самовывоза").get_by_role("radio").all()]
        check(f"{name}: три вкладки помещаются в ряд, каждая ≥ 44 px высотой, без прокрутки вбок", not over and len(boxes) == 3 and all(bx["height"] >= 44 for bx in boxes) and boxes[-1]["x"] + boxes[-1]["width"] <= vp["width"], (over, boxes))
        if name == "320×568": page.screenshot(path=os.path.join(OUT, "breakfast_320.png"))
        ctx.close()
    try:
        from axe_playwright_python.sync_playwright import Axe
        axe = Axe(); tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
        for scheme in ("dark", "light"):
            ctx, page, errs = open_home(b, msk(8, 0), scheme=scheme); select(page, "Завтрак")
            bad = [(v["id"], [n["target"] for n in v["nodes"]][:2]) for v in axe.run(page, options={"runOnly": {"type": "tag", "values": tags}}).response["violations"]]
            check(f"axe ({scheme}): «Сейчас» с вкладкой «Завтрак» — 0 нарушений WCAG AA", not bad, bad); ctx.close()
    except ImportError:
        print("[SKIP] axe-playwright-python не установлен")
    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
