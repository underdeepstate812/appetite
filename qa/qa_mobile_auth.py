"""QA экранов входа и регистрации мобильного web-приложения на ЗАМОКАННОМ API: сеть и пароли не нужны.
Фикстуры — заведомо фиктивные значения. Запуск: python3 qa/qa_mobile_auth.py (нужен mobile-web на :8081)."""
import json, os, re, sys, tempfile
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright

BASE = os.environ.get("MOBILE_URL", "http://localhost:8081")
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())
FAKE_PASSWORD = "Qa-Fake-Pass-1!"
NOW = datetime.now(timezone.utc)
iso = lambda hours: (NOW + timedelta(hours=hours)).isoformat().replace("+00:00", "Z")
results = []

def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))

def nearby_offer(featured=True, n=1):
    return {"id": f"off-{n}", "businessId": f"b{n}", "title": "Пицца «Маргарита» + «Пепперони», 2 шт" if n == 1 else ("Паста Карбонара" if n == 2 else f"Блюдо номер {n}"), "description": None, "category": "FOOD", "originalPrice": 119000,
            "discountedPrice": 35700, "discountPercent": 70, "baseDiscountPercent": 70, "imageUrl": None, "quantityTotal": 12, "quantityLeft": 12, "weightKg": 0.9,
            "pickupStart": iso(-1), "pickupEnd": iso(24), "status": "ACTIVE", "featured": featured, "createdAt": iso(-2), "updatedAt": iso(-1),
            "businessName": "JoyPizza" if n == 1 else ("Trattoria Uno" if n == 2 else f"Заведение {n}"), "businessAddress": "Искровский проспект, 40", "businessLat": 59.89, "businessLng": 30.47, "businessLogoUrl": None, "distanceKm": 7.6}

def install_api(ctx, st):
    def handler(route, request):
        method = request.method
        path = re.sub(r"^https?://[^/]+/api/v1", "", request.url).split("?")[0]
        if method == "OPTIONS":
            return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
        st["calls"].append((method, path, request.post_data))
        def ok(data, status=200): route.fulfill(status=status, content_type="application/json", body=json.dumps(data), headers={"access-control-allow-origin": "*"})
        if st.get("offline"): return route.abort("connectionrefused")
        if path == "/offers/nearby":
            if st.get("nearby_fail"): return ok({"statusCode": 500, "message": "boom"}, 500)
            return ok([] if st.get("nearby_empty") else [nearby_offer(st.get("featured", True))] + ([nearby_offer(False, 2)] if st.get("two_offers") else []) + ([nearby_offer(False, k) for k in range(2, 7)] if st.get("six_offers") else []))
        if path in ("/auth/login", "/auth/register"):
            if st.get("auth_error"): return ok({"statusCode": 401, "message": st["auth_error"]}, 401)
            user = {"id": "u1", "email": "qa@example.test", "phone": None, "name": "Тест", "avatarUrl": None, "role": "USER", "notifyRadiusKm": 5, "createdAt": iso(-1), "updatedAt": iso(-1)}
            return ok({"user": user, "accessToken": "fake.a.b", "refreshToken": "fake.r.b"}, 201 if path.endswith("register") else 200)
        return ok({"statusCode": 404, "message": "not mocked"}, 404)
    ctx.route("**/api/v1/**", handler)

def new_page(b, vp=None, scheme="light", reduced=False, **opts):
    st = {"calls": []}
    ctx = b.new_context(viewport=vp or {"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, color_scheme=scheme,
                        reduced_motion="reduce" if reduced else "no-preference", **opts)
    install_api(ctx, st)
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:160]))
    return ctx, page, st, errs

def open_login(page):
    """Неавторизованного встречает приветственная страница (после заставки): форма входа открывается кнопкой «Войти»."""
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.get_by_role("button", name="Войти", exact=True).click(timeout=30000)
    fld(page, "Пароль").wait_for(timeout=30000)

def fld(page, label):
    """Видимое поле ввода по точной подписи (скрытый экран под регистрацией и глазок «Показать пароль» не мешают)."""
    return page.locator(f'input[aria-label="{label}"]:visible')

def shift_clock(ctx, hh, mm=0):
    """Сдвигает часы страницы на заданное время суток (ход времени сохраняется — анимации идут): так проверяем небо героя в любой час."""
    ctx.add_init_script("""(() => { const T = new Date(2026, 9, 6, %d, %d).getTime(); const off = T - Date.now(); const R = Date;
      class F extends R { constructor(...a) { if (a.length === 0) super(R.now() + off); else super(...a); } static now() { return R.now() + off; } } window.Date = F; })()""" % (hh, mm))

def sky(page):
    return page.evaluate("() => { const h = document.querySelector('[data-testid=day-hero]'); return h ? { phase: h.getAttribute('data-day-phase'), top: h.getAttribute('data-sky-top'), hour: h.getAttribute('data-hour'), heat: h.getAttribute('data-heat'), circles: h.querySelectorAll('svg circle').length } : null }")

def poster_title(page):
    label = page.get_by_role("button", name=re.compile("Нажмите, чтобы увидеть следующее")).get_attribute("aria-label") or ""
    m = re.search(r": ([^,]+),", label)
    return m.group(1) if m else label

def calls_to(st, path): return [c for c in st["calls"] if c[1] == path and c[0] == "POST"]

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ---------- вход: структура и живой оффер ----------
    ctx, page, st, errs = new_page(b); open_login(page); page.wait_for_timeout(1500)
    check("вход: заголовок и подзаголовок", page.get_by_text("Вход", exact=True).count() >= 1 and page.get_by_text("Рады видеть снова").count() == 1)
    check("вход: постер оффера дня с гигантской цифрой скидки", page.get_by_text("Предложение дня").count() >= 1 and page.get_by_text("−70", exact=True).count() >= 1)
    check("вход: на постере блюдо и заведение", page.get_by_text("Пицца «Маргарита»").count() >= 1 and page.get_by_text("JoyPizza", exact=False).count() >= 1)
    check("вход: фон героя — «небо» по времени суток (SVG), диск и орбиты нарисованы", page.evaluate("""() => { const h = document.querySelector('[data-testid=day-hero]'); if (!h) return false; const svg = h.querySelector('svg'); return !!svg && svg.getBoundingClientRect().width > 100 && h.querySelectorAll('circle').length >= 7 && !!h.getAttribute('data-day-phase') }"""))
    check("вход: на постере один оффер — переключателя нет", page.get_by_role("button", name=re.compile("Нажмите, чтобы увидеть следующее")).count() == 0)
    check("вход: нет горизонтальной прокрутки", not page.evaluate("document.documentElement.scrollWidth > innerWidth"))
    page.screenshot(path=os.path.join(OUT, "auth_login.png"))
    ctx.close()

    # ---------- вход: фолбэки тизера ----------
    for label, mode in (("ошибка API", {"nearby_fail": True}), ("пустая витрина", {"nearby_empty": True})):
        ctx, page, st, errs = new_page(b); st.update(mode); open_login(page); page.wait_for_timeout(1200)
        check(f"тизер: при «{label}» — запасной текст, форма работает", page.get_by_text("Скидки до 70%").count() == 1 and fld(page, "Email").count() == 1)
        ctx.close()

    # ---------- вход: кнопка как на сайте ----------
    ctx, page, st, errs = new_page(b); open_login(page)
    shape = page.get_by_role("button", name="Войти", exact=True).evaluate("e => { const s=getComputedStyle(e); return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius, s.backgroundColor, s.minHeight] }")
    check("кнопка: фирменный контур 4/18/4/18 как .btn на сайте", shape[:4] == ["4px", "18px", "4px", "18px"], shape)
    check("кнопка: плоская заливка бренд-цветом #0F766E и высота ≥ 48", shape[4] == "rgb(15, 118, 110)" and float(shape[5].replace("px", "")) >= 48, shape)
    check("кнопка: глянец (SVG-градиент) и стрелка-спутник внутри", page.get_by_role("button", name="Войти", exact=True).locator("svg").count() >= 2)
    ctx.close()

    # ---------- вход: постер листает предложения ----------
    ctx, page, st, errs = new_page(b); st["two_offers"] = True; open_login(page); page.wait_for_timeout(1200)
    nxt = page.get_by_role("button", name=re.compile("Нажмите, чтобы увидеть следующее"))
    check("постер: при двух предложениях есть переключатель", nxt.count() == 1)
    check("постер: сначала предложение дня", page.get_by_text("Пицца «Маргарита»").count() >= 1)
    nxt.click(); page.wait_for_timeout(700)
    check("постер: по нажатию — следующее предложение", page.get_by_text("Паста Карбонара").count() >= 1 and page.get_by_text("Пицца «Маргарита»").count() == 0)
    page.wait_for_timeout(3900)
    check("постер: сам возвращается к первому (≈3 с на карточку)", page.get_by_text("Пицца «Маргарита»").count() >= 1)
    ctx.close()
    ctx, page, st, errs = new_page(b, reduced=True); st["two_offers"] = True; open_login(page); page.wait_for_timeout(1200); page.wait_for_timeout(7500)
    check("reduced-motion: постер не листается сам", page.get_by_text("Пицца «Маргарита»").count() >= 1 and page.get_by_text("Паста Карбонара").count() == 0)
    ctx.close()

    # ---------- вход: небо героя по времени суток ----------
    skies = {}
    for hh, mm, want in ((3, 0, "night"), (6, 40, "dawn"), (12, 30, "day"), (18, 15, "golden"), (20, 0, "sunset"), (22, 30, "night")):
        ctx, page, st, errs = new_page(b); shift_clock(ctx, hh, mm); open_login(page); page.wait_for_timeout(1500)
        info = sky(page); skies[(hh, mm)] = info
        check(f"небо в {hh:02d}:{mm:02d} — «{want}»", info and info["phase"] == want, info)
        if (hh, mm) in ((3, 0), (12, 30), (20, 0)): page.screenshot(path=os.path.join(OUT, f"auth_sky_{hh:02d}{mm:02d}.png"), clip={"x": 0, "y": 0, "width": 390, "height": 380})
        ctx.close()
    tops = [skies[k]["top"] for k in ((3, 0), (6, 40), (12, 30), (18, 15), (20, 0))]
    check("цвет неба меняется в течение суток: пять разных оттенков", len(set(tops)) == 5, tops)
    check("ночью небо со звёздами (больше элементов, чем днём)", skies[(3, 0)]["circles"] > skies[(12, 30)]["circles"] + 15, (skies[(3, 0)]["circles"], skies[(12, 30)]["circles"]))
    check("ночь в 3:00 и в 22:30 — одна фаза, но разные оттенки (небо перетекает, а не щёлкает)", skies[(3, 0)]["top"] != skies[(22, 30)]["top"])
    ctx, page, st, errs = new_page(b); shift_clock(ctx, 12, 30); open_login(page); page.wait_for_timeout(1500)
    check("жар предложения передан небу (гало диска): у предложения дня он задан числом", re.match(r"^0\.\d\d$", sky(page)["heat"] or "") is not None, sky(page))
    ctx.close()
    ctx, page, st, errs = new_page(b, scheme="dark"); shift_clock(ctx, 21, 0); open_login(page); page.wait_for_timeout(1200)
    check("небо одинаково в обеих темах оформления (герой всегда тёмный)", sky(page)["phase"] in ("sunset", "dusk"))
    ctx.close()

    # ---------- вход: настоящие предложения проходят карточками быстро ----------
    ctx, page, st, errs = new_page(b); st["six_offers"] = True; open_login(page); page.wait_for_timeout(1200)
    dashes = page.evaluate("() => [...document.querySelectorAll('[aria-hidden=true]')].some(e => e.children.length === 6 && [...e.children].every(c => c.getBoundingClientRect().height <= 4 && c.getBoundingClientRect().height > 0))")
    check("полоски «как в историях»: по одной на каждое из шести предложений", dashes)
    seen = []; stamps = []
    import time
    t0 = time.time()
    while time.time() - t0 < 11.5:
        title = poster_title(page)
        if not seen or seen[-1] != title: seen.append(title); stamps.append(round(time.time() - t0, 1))
        page.wait_for_timeout(150)
    check("за 11 с мимо проходит не меньше четырёх разных предложений (≈3 с на каждое)", len(set(seen)) >= 4, seen)
    gaps = [round(b2 - a2, 1) for a2, b2 in zip(stamps[:-1], stamps[1:])][1:]  # первый промежуток неполный: замер начался уже после появления постера
    check("интервал смены ≈ 3,2 с (2,7…3,9)", len(gaps) >= 2 and all(2.7 <= g <= 3.9 for g in gaps), gaps)
    check("первым — предложение дня, дальше — другие заведения", seen[0].startswith("Пицца") and len(set(seen[:4])) == 4, seen)
    # удержание палаццем ставит смену на паузу
    poster = page.get_by_role("button", name=re.compile("Нажмите, чтобы увидеть следующее")); box = poster.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); page.mouse.down(); page.wait_for_timeout(400)  # пауза включается через ~130 мс после касания — дожидаемся её
    before = poster_title(page); page.wait_for_timeout(4500)
    held_same = poster_title(page) == before
    page.mouse.up(); page.wait_for_timeout(300)
    check("пока постер удерживают, смена стоит (4,5 с без изменений)", held_same, (before, poster_title(page)))
    after_release = poster_title(page); page.wait_for_timeout(4000)
    check("после отпускания лента идёт дальше", poster_title(page) != after_release, (after_release, poster_title(page)))
    check("нет JS-ошибок на «ленте» предложений", not errs, errs[:2]); ctx.close()
    ctx, page, st, errs = new_page(b, reduced=True); st["six_offers"] = True; open_login(page); page.wait_for_timeout(1200)
    first = poster_title(page); page.wait_for_timeout(7000)
    check("reduce-motion: шесть предложений, но сами не листаются", poster_title(page) == first, (first, poster_title(page)))
    page.get_by_role("button", name=re.compile("Нажмите, чтобы увидеть следующее")).click(); page.wait_for_timeout(500)
    check("reduce-motion: по касанию следующее открывается", poster_title(page) != first)
    ctx.close()

    # ---------- вход: валидация по месту (кнопка не «мёртвая») ----------
    ctx, page, st, errs = new_page(b); open_login(page)
    btn = page.get_by_role("button", name="Войти", exact=True)
    check("кнопка «Войти» активна на пустой форме (не disabled)", btn.is_enabled())
    btn.click(); page.wait_for_timeout(300)
    check("пустая отправка: ошибки у email и пароля", page.get_by_text("Введите email").count() == 1 and page.get_by_text("Введите пароль").count() == 1)
    check("пустая отправка: запрос не ушёл", not calls_to(st, "/auth/login"))
    check("пустая отправка: фокус на первом неверном поле", page.evaluate("document.activeElement && document.activeElement.getAttribute('aria-label')") == "Email")
    fld(page, "Email").fill("не-почта"); fld(page, "Пароль").click(); page.wait_for_timeout(250)
    check("email проверяется при уходе с поля", page.get_by_text("Проверьте email").count() == 1)
    fld(page, "Email").fill("qa@example.test"); page.wait_for_timeout(200)
    check("ошибка гаснет, как только человек правит поле", page.get_by_text("Проверьте email").count() == 0)
    ctx.close()

    # ---------- вход: пароль, автозаполнение, клавиатура ----------
    ctx, page, st, errs = new_page(b); open_login(page)
    check("пароль скрыт по умолчанию", fld(page, "Пароль").evaluate("e => e.type") == "password")
    page.get_by_role("button", name="Показать пароль").click(); page.wait_for_timeout(150)
    check("глазок показывает пароль", fld(page, "Пароль").evaluate("e => e.type") == "text")
    check("подпись глазка меняется на «Скрыть»", page.get_by_role("button", name="Скрыть пароль").count() == 1)
    page.get_by_role("button", name="Скрыть пароль").click()
    attrs = page.evaluate("""() => { const a=(l)=>{const e=document.querySelector(`[aria-label="${l}"]`); return e? [e.getAttribute('autocomplete'), e.getAttribute('enterkeyhint')]: null}; return {email:a('Email'), pw:a('Пароль')} }""")
    check("автозаполнение: логин=username, пароль=current-password", attrs["email"][0] == "username" and attrs["pw"][0] == "current-password", attrs)
    check("клавиатура: «Далее» на логине, «Перейти» на пароле", attrs["email"][1] == "next" and attrs["pw"][1] == "go", attrs)
    fld(page, "Email").fill("qa@example.test"); page.keyboard.press("Enter"); page.wait_for_timeout(200)
    check("Enter в логине переводит на пароль", page.evaluate("document.activeElement.getAttribute('aria-label')") == "Пароль")
    page.keyboard.type(FAKE_PASSWORD); page.keyboard.press("Enter"); page.wait_for_timeout(600)
    sent = calls_to(st, "/auth/login")
    check("Enter в пароле отправляет вход ровно один раз", len(sent) == 1, len(sent))
    check("в запросе нужные поля", sent and json.loads(sent[0][2]) == {"identifier": "qa@example.test", "password": FAKE_PASSWORD}, sent and sent[0][2])
    ctx.close()

    # ---------- вход: телефон ----------
    ctx, page, st, errs = new_page(b); open_login(page)
    page.get_by_role("button", name="Войти по номеру телефона").click(); page.wait_for_timeout(300)
    check("режим телефона: поле «Телефон», подпись переключателя сменилась", fld(page, "Телефон").count() == 1 and page.get_by_role("button", name="Войти по email").count() == 1)
    check("режим телефона: фокус перешёл в поле", page.evaluate("document.activeElement.getAttribute('aria-label')") == "Телефон")
    fld(page, "Телефон").fill("89001234567"); page.wait_for_timeout(150)
    check("телефон нормализуется в +7XXXXXXXXXX", fld(page, "Телефон").input_value() == "+79001234567", fld(page, "Телефон").input_value())
    fld(page, "Пароль").fill(FAKE_PASSWORD); page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_timeout(600)
    sent = calls_to(st, "/auth/login"); check("вход по телефону отправляет identifier=+79001234567", sent and json.loads(sent[0][2])["identifier"] == "+79001234567", sent and sent[0][2])
    ctx.close()
    ctx, page, st, errs = new_page(b); open_login(page)
    page.get_by_role("button", name="Войти по номеру телефона").click(); fld(page, "Телефон").fill("+7900"); fld(page, "Пароль").fill(FAKE_PASSWORD)
    page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_timeout(300)
    check("неполный телефон: понятная ошибка, запроса нет", page.get_by_text("Номер в формате").count() == 1 and not calls_to(st, "/auth/login"))
    ctx.close()

    # ---------- вход: ошибки сервера и сети ----------
    ctx, page, st, errs = new_page(b); st["auth_error"] = "Неверный логин или пароль"; open_login(page)
    fld(page, "Email").fill("qa@example.test"); fld(page, "Пароль").fill("wrong"); page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_timeout(700)
    check("неверный пароль: сообщение сервера в заметном блоке", page.get_by_role("alert").filter(has_text="Неверный логин или пароль").count() == 1)
    check("после ошибки форма сохраняет ввод и кнопка снова доступна", fld(page, "Email").input_value() == "qa@example.test" and page.get_by_role("button", name="Войти", exact=True).is_enabled())
    page.screenshot(path=os.path.join(OUT, "auth_login_error.png"))
    ctx.close()
    ctx, page, st, errs = new_page(b); open_login(page); st["offline"] = True
    fld(page, "Email").fill("qa@example.test"); fld(page, "Пароль").fill(FAKE_PASSWORD); page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_timeout(700)
    check("нет сети: «Нет соединения…», а не «Failed to fetch»", page.get_by_text("Нет соединения с сервером").count() == 1 and page.get_by_text("Failed to fetch").count() == 0)
    ctx.close()

    # ---------- регистрация ----------
    ctx, page, st, errs = new_page(b); open_login(page)
    page.get_by_text("Создать", exact=True).click(); fld(page, "Имя").wait_for(timeout=10000); page.wait_for_timeout(500)
    check("регистрация: все поля и чек-лист пароля", all(fld(page, l).count() == 1 for l in ("Имя", "Email", "Пароль")) and page.get_by_text("Пароль должен содержать").count() == 1)
    check("регистрация: компактный герой — обещание вместо постера", page.locator('text="Горячие скидки рядом" >> visible=true').count() == 1 and page.locator('text="Предложение дня" >> visible=true').count() == 0)
    check("регистрация: телефон помечен необязательным", fld(page, "Телефон (необязательно)").count() == 1)
    page.screenshot(path=os.path.join(OUT, "auth_register.png"))
    def rules_text(): return page.get_by_label(re.compile("Требования к паролю")).first.get_attribute("aria-label")
    check("чек-лист: сначала 0 из 5", "0 из 5" in rules_text(), rules_text())
    pwd = fld(page, "Пароль")
    pwd.fill("abc"); page.wait_for_timeout(120); check("чек-лист: «abc» → 1 из 5 (строчная)", "1 из 5" in rules_text(), rules_text())
    pwd.fill("Abcdefg1"); page.wait_for_timeout(120); check("чек-лист: «Abcdefg1» → 4 из 5 (нет спецсимвола)", "4 из 5" in rules_text(), rules_text())
    pwd.fill(FAKE_PASSWORD); page.wait_for_timeout(120); check("чек-лист: все 5 из 5", "5 из 5" in rules_text(), rules_text())
    pwd.fill("")
    page.get_by_role("button", name="Зарегистрироваться").click(); page.wait_for_timeout(300)
    check("пустая регистрация: ошибки по полям и фокус на имени", page.get_by_text("Укажите имя").count() == 1 and page.get_by_text("Введите email").count() == 1 and page.get_by_text("Введите пароль").count() == 1
          and page.evaluate("document.activeElement.getAttribute('aria-label')") == "Имя")
    check("пустая регистрация: запрос не ушёл", not calls_to(st, "/auth/register"))
    fld(page, "Имя").fill("Тест"); fld(page, "Email").fill("qa@example.test"); fld(page, "Телефон (необязательно)").fill("+7900")
    fld(page, "Пароль").fill("Abcdefg1"); page.get_by_role("button", name="Зарегистрироваться").click(); page.wait_for_timeout(300)
    check("слабый пароль и неполный телефон блокируют отправку с понятными ошибками", page.get_by_text("Номер в формате").count() == 1 and page.get_by_text("не соответствует требованиям").count() == 1 and not calls_to(st, "/auth/register"))
    fld(page, "Телефон (необязательно)").fill(""); fld(page, "Пароль").fill(FAKE_PASSWORD); page.get_by_role("button", name="Зарегистрироваться").click(); page.wait_for_timeout(700)
    sent = calls_to(st, "/auth/register")
    check("корректная регистрация уходит один раз без пустого телефона", len(sent) == 1 and "phone" not in json.loads(sent[0][2]) and json.loads(sent[0][2])["email"] == "qa@example.test", sent and sent[0][2])
    ctx.close()

    # ---------- навигация вход ⇄ регистрация, темы, адаптивность ----------
    ctx, page, st, errs = new_page(b); open_login(page)
    page.get_by_text("Создать", exact=True).click(); fld(page, "Имя").wait_for(); page.get_by_text("Войти", exact=True).last.click(); page.wait_for_timeout(600)
    check("регистрация → вход возвращает на вход", page.get_by_text("Рады видеть снова").count() >= 1)
    ctx.close()
    for scheme in ("light", "dark"):
        for name, vp in (("маленький телефон 320×568", {"width": 320, "height": 568}), ("обычный 390×844", {"width": 390, "height": 844}), ("планшет 768×1024", {"width": 768, "height": 1024})):
            ctx, page, st, errs = new_page(b, vp, scheme); open_login(page); page.wait_for_timeout(700)
            overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
            btn_box = page.get_by_role("button", name="Войти", exact=True).bounding_box()
            reachable = page.get_by_role("button", name="Войти", exact=True).count() == 1
            check(f"{scheme} / {name}: без горизонтальной прокрутки, кнопка есть", not overflow and reachable and btn_box and btn_box["width"] > 200, (overflow, btn_box))
            ctx.close()
    ctx, page, st, errs = new_page(b, scheme="dark"); open_login(page); page.wait_for_timeout(1500); page.screenshot(path=os.path.join(OUT, "auth_login_dark.png"))
    page.get_by_text("Создать", exact=True).click(); fld(page, "Имя").wait_for(); page.wait_for_timeout(800); page.screenshot(path=os.path.join(OUT, "auth_register_dark.png"))
    mark_ok = page.evaluate("""() => { const svgs=[...document.querySelectorAll('svg')].filter(s=>s.getBoundingClientRect().width>0 && s.querySelector('path[fill^="url(#"]')); return svgs.length>0 && svgs.every(s=>{ const f=s.querySelector('path[fill^="url(#"]').getAttribute('fill'); const id=f.slice(5,-1); return !!s.querySelector('[id="'+id+'"]') }) }""")
    check("логотип виден на регистрации: градиент разрешается в своём SVG (нет конфликта id между экранами)", mark_ok)
    ids = page.evaluate("(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id); return ids.length-new Set(ids).size})()")
    check("в документе нет дублирующихся id", ids == 0, ids)
    ctx.close()

    # ---------- доступность (axe-core, WCAG 2.1 A/AA) — если библиотека установлена ----------
    try:
        from axe_playwright_python.sync_playwright import Axe
        axe = Axe(); tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
        def axe_violations(page): return [v["id"] for v in axe.run(page, options={"runOnly": {"type": "tag", "values": tags}}).response["violations"]]
        for scheme in ("light", "dark"):
            ctx, page, st, errs = new_page(b, scheme=scheme, reduced=True); open_login(page); page.wait_for_timeout(1000)
            bad = axe_violations(page); page.get_by_role("button", name="Войти", exact=True).click(); page.wait_for_timeout(300); bad += axe_violations(page)
            page.get_by_text("Создать", exact=True).click(); fld(page, "Имя").wait_for(); page.wait_for_timeout(600)
            bad += axe_violations(page); page.get_by_role("button", name="Зарегистрироваться").click(); page.wait_for_timeout(300); bad += axe_violations(page)
            check(f"axe ({scheme}): вход и регистрация, с ошибками и без — 0 нарушений WCAG AA", not bad, bad); ctx.close()
    except ImportError:
        print("[SKIP] axe-playwright-python не установлен — a11y-аудит пропущен")

    # ---------- reduced motion и общая чистота ----------
    ctx, page, st, errs = new_page(b, reduced=True); open_login(page); page.wait_for_timeout(1000)
    check("reduced-motion: экран собирается и работает", fld(page, "Email").count() == 1 and page.get_by_text("Пицца «Маргарита»").count() >= 1)
    check("нет JS-ошибок на экране входа", not errs, errs[:2]); ctx.close()
    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
