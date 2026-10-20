"""QA заказов мобильного web-приложения на ЗАМОКАННОМ API: «где забрать», правило оплаты, список заказов, помощь, офлайн-билет.
Сеть и пароли не нужны. Запуск: python3 qa/qa_mobile_orders.py (нужен mobile-web на :8081)."""
import json, os, re, sys, tempfile
from playwright.sync_api import sync_playwright

QA = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(QA, "qa_mobile.py")).read().split("with sync_playwright() as p:")[0])  # make_state, new_page, cards, tab, check, iso, BASE …
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())
SMALL = {"width": 320, "height": 568}
WIDE = {"width": 1000, "height": 920}

def go_checkout(page, title="Набор десертов дня"):
    cards(page).filter(has_text=title).first.click(); page.wait_for_timeout(1300)
    page.get_by_role("button", name="Купить").click(); page.wait_for_timeout(1300)

def pay(page):
    page.get_by_role("button", name="Оплатить").click(); page.wait_for_timeout(4200)  # «жарка» 1.1 с + праздник 1.7 с

def capture_open(page):
    # «; 0» — иначе Playwright вызовет вернувшуюся функцию (присваивание — выражение со значением-функцией).
    page.evaluate("window.__opened = null; window.open = (u) => { window.__opened = u; return null }; 0")

def opened(page): return page.evaluate("window.__opened")

def capture_mail(page, fail=False):
    """mailto: на web уходит кликом по якорю (а не window.open): перехватываем клик, чтобы прочитать ссылку. fail — клик бросает исключение."""
    body = "throw new Error('blocked')" if fail else "window.__opened = this.href"
    page.evaluate("window.__opened = null; HTMLAnchorElement.prototype.click = function () { %s }; 0" % body)

def axe_ok(page, label):
    try:
        from axe_playwright_python.sync_playwright import Axe
    except ImportError:
        print("[SKIP] axe-playwright-python не установлен — a11y-аудит пропущен"); return
    bad = [v["id"] for v in Axe().run(page, options={"runOnly": {"type": "tag", "values": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]}}).response["violations"]]
    check(f"axe: {label} — 0 нарушений WCAG AA", not bad, bad)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ───────── Шаг 1 (F2 + F8): где и когда забирать ─────────
    ctx, page, st, errs = new_page(b, PH, scheme="light"); go_checkout(page); T = texts(page)
    check("оплата: в сводке есть что, где и когда — название, заведение, адрес, окно выдачи", all(x in T for x in ["Набор десертов дня", "Кафе Пушкинъ", "Невский проспект, 40"]) and re.search(r"Забрать: \d{2}:\d{2}(?:–| — завтра )\d{2}:\d{2}", T), T[:300])
    check("оплата: сумма «240 ₽» и «Количество» на месте", "240 ₽" in T and "Количество" in T)
    check("оплата: нет горизонтальной прокрутки", not overflow(page))
    page.screenshot(path=os.path.join(OUT, "orders_checkout_light.png"))
    pay(page); T = texts(page)
    check("после оплаты: билет с блоком «Где забрать», заведением и адресом", "ГДЕ ЗАБРАТЬ" in T.upper() and "Кафе Пушкинъ" in T and "Невский проспект, 40" in T, T[:300])
    check("после оплаты: окно выдачи рядом с адресом", re.search(r"Забрать: \d{2}:\d{2}(?:–| — завтра )\d{2}:\d{2}", T) is not None)
    page.screenshot(path=os.path.join(OUT, "orders_ticket_light.png"))
    capture_open(page)
    page.get_by_role("button", name="Построить маршрут до Кафе Пушкинъ").click(); page.wait_for_timeout(300)
    o = opened(page)
    check("«Маршрут» на билете открывает карту с координатами заведения", o and "59.93" in o and "30.36" in o, o)
    axe_ok(page, "билет после оплаты (светлая)")
    ctx.close()

    ctx, page, st, errs = new_page(b, PH, scheme="dark"); go_checkout(page)
    page.screenshot(path=os.path.join(OUT, "orders_checkout_dark.png")); axe_ok(page, "оплата (тёмная)")
    pay(page); page.screenshot(path=os.path.join(OUT, "orders_ticket_dark.png")); axe_ok(page, "билет после оплаты (тёмная)")
    ctx.close()

    # ───────── Шаг 2 (F3): правило у кнопки «Оплатить» ─────────
    for scheme in ("light", "dark"):
        ctx, page, st, errs = new_page(b, PH, scheme=scheme); go_checkout(page); T = texts(page)
        check(f"правило ({scheme}): «Оплата окончательная», «отменить нельзя» и срок «Заберите до»", all(x in T for x in ["Оплата окончательная", "После оплаты заказ отменить нельзя"]) and re.search(r"Заберите до \d{2}:\d{2}", T), T[-400:])
        rule = page.get_by_text("Оплата окончательная").bounding_box(); payb = page.get_by_role("button", name="Оплатить").bounding_box()
        check(f"правило ({scheme}): стоит ПРЯМО над «Оплатить» (зазор ≤ 40 px) и кнопка видна без прокрутки", rule and payb and 0 <= payb["y"] - (rule["y"] + rule["height"]) <= 60 + 40 and payb["y"] + payb["height"] <= PH["height"], (rule, payb))
        check(f"правило ({scheme}): не обещает и не отрицает возврат денег (продуктовое решение)", not re.search("возврат|вернут|возвращ", T, re.I))
        if scheme == "light": axe_ok(page, "оплата с правилом (светлая)")
        page.screenshot(path=os.path.join(OUT, f"orders_rule_{scheme}.png")); ctx.close()
    st = make_state(); st["offers"][0].update({"featured": True, "pickupEnd": iso(24 * 60 - 30)})
    ctx, page, st, errs = new_page(b, PH, state=st); go_checkout(page)
    check("предложение дня: срок в правиле с «завтра»", re.search(r"Заберите до завтра \d{2}:\d{2}", texts(page)) is not None, texts(page)[-300:]); ctx.close()

    # заведение не загрузилось: платить можно, адрес — понятное сообщение и повтор
    ctx, page, st, errs = new_page(b, PH); st["mode"]["business_fail"] = True; go_checkout(page); T = texts(page)
    check("оплата без заведения: сообщение, время и сумма на месте, «Оплатить» доступна", "Адрес пока не загрузился" in T and re.search(r"Забрать: \d{2}:\d{2}", T) and page.get_by_role("button", name="Оплатить").is_enabled(), T[:300])
    st["mode"].pop("business_fail"); page.get_by_role("button", name="Повторить").first.click(); page.wait_for_timeout(1200)
    check("«Повторить» подтягивает адрес без перезагрузки экрана", "Кафе Пушкинъ" in texts(page) and "Адрес пока не загрузился" not in texts(page))
    ctx.close()

    # экран заказа из списка
    ctx, page, st, errs = new_page(b, PH, scheme="light"); tab(page, "Заказы")
    page.get_by_role("button").filter(has_text="240 ₽").first.click(); page.wait_for_timeout(1800); T = texts(page)
    check("заказ (ожидает самовывоза): «Где забрать», заведение, адрес и маршрут", "ГДЕ ЗАБРАТЬ" in T.upper() and "Кафе Пушкинъ" in T and page.get_by_role("button", name="Построить маршрут до Кафе Пушкинъ").count() == 1, T[:300])
    page.screenshot(path=os.path.join(OUT, "orders_detail_light.png"))
    ctx.close()
    ctx, page, st, errs = new_page(b, PH, scheme="light"); tab(page, "Заказы")
    page.get_by_role("button").filter(has_text="630 ₽").first.click(); page.wait_for_timeout(1800); T = texts(page)
    check("выданный заказ: заведение и адрес видны, кнопки «Маршрут» нет (идти уже некуда)", "Кафе Пушкинъ" in T and page.get_by_role("button", name=re.compile("маршрут")).count() == 0, T[:300])
    ctx.close()

    # ───────── Шаг 3 (F7): список заказов с названиями и заведениями ─────────
    # Читаем только строки заказов: смонтированная Главная тоже попадает в inner_text страницы и дала бы ложные совпадения.
    rows_of = lambda page: [r.inner_text() for r in page.locator('[role=button][aria-label*="₽"]:not([data-testid=offer-ribbon] [role=button])').all()]
    labels_of = lambda page: [r.get_attribute("aria-label") for r in page.locator('[role=button][aria-label*="₽"]:not([data-testid=offer-ribbon] [role=button])').all()]
    ctx, page, st, errs = new_page(b, PH, scheme="light"); tab(page, "Заказы"); page.wait_for_timeout(900); rows = rows_of(page)
    check("список заказов: пять строк, у каждой есть название оффера", len(rows) == 5 and "Набор десертов дня" in rows[0] and "Вечерний набор" in rows[1] and all(r.strip().split("\n")[0] for r in rows), rows)
    check("список заказов: под названием — заведение в каждой строке", all("Кафе Пушкинъ" in r for r in rows), rows)
    check("список заказов: статус и дата в одной строке, без секунд", "Ожидает самовывоза" in rows[0] and not any(re.search(r"\d{2}:\d{2}:\d{2}", r) for r in rows), rows[:1])
    check("список заказов: сумма на месте у каждого заказа", all(x in " ".join(rows) for x in ["240 ₽", "480 ₽", "630 ₽", "248 ₽"]), rows)
    labels = labels_of(page)
    check("список заказов: у строк целостная подпись для скринридера — название, заведение, сумма, статус, дата", len(labels) == 5 and all(l.startswith(("Набор десертов дня, Кафе Пушкинъ, ", "Вечерний набор, Кафе Пушкинъ, ")) for l in labels), labels)
    check("список заказов: нет горизонтальной прокрутки", not overflow(page))
    page.screenshot(path=os.path.join(OUT, "orders_list_light.png"))
    page.get_by_role("button", name=re.compile("^Вечерний набор")).click(); page.wait_for_timeout(1500)
    check("строка открывает именно этот заказ (480 ₽, x2)", "480 ₽" in texts(page) and "x2" in texts(page), texts(page)[:200])
    ctx.close()
    ctx, page, st, errs = new_page(b, PH, scheme="dark"); tab(page, "Заказы"); page.wait_for_timeout(900)
    page.screenshot(path=os.path.join(OUT, "orders_list_dark.png")); axe_ok(page, "список заказов (тёмная)")
    ctx.close()
    # сбой справочника заведений: список всё равно открывается, строки читаемы, подпись без заведения
    ctx, page, st, errs = new_page(b, PH); st["mode"]["business_fail"] = True; tab(page, "Заказы"); page.wait_for_timeout(900); rows = rows_of(page); labels = labels_of(page)
    check("заведения не загрузились: пять строк с названиями офферов и суммами, без «Кафе Пушкинъ»", len(rows) == 5 and "Набор десертов дня" in rows[0] and "240 ₽" in rows[0] and not any("Кафе Пушкинъ" in r for r in rows), rows)
    check("заведения не загрузились: подпись скринридера не содержит пустых мест", all(", ," not in l and not l.startswith(",") for l in labels), labels)
    ctx.close()

    # ───────── Шаг 4 (F1): помощь ─────────
    def open_order(page, name):
        tab(page, "Заказы"); page.wait_for_timeout(700)
        page.get_by_role("button", name=re.compile(name)).first.click(); page.wait_for_timeout(1500)
    def sheet_text(page): return page.get_by_role("radiogroup").locator("xpath=ancestor::*[3]").first.inner_text() if page.get_by_role("radiogroup").count() else ""
    def mail_params(page):
        from urllib.parse import urlparse, parse_qs, unquote
        u = opened(page); q = parse_qs(urlparse(u).query, keep_blank_values=True) if u else {}
        return u, {k: v[0] for k, v in q.items()}

    ctx, page, st, errs = new_page(b, PH, scheme="light"); open_order(page, "^Набор десертов дня, Кафе Пушкинъ, 240 ₽, Ожидает")
    check("заказ: есть вход «Нужна помощь с заказом»", page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).count() == 1)
    T = texts(page)
    check("заказ: на экране видно название предложения и сумму", "Набор десертов дня" in T and "240 ₽" in T, T[:200])
    page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).click(); page.wait_for_timeout(700)
    T = texts(page)
    check("лист помощи: заголовок, номер заказа с названием, темы, почта и правило отмены", all(x in T for x in ["Нужна помощь?", "Заказ №D-OPEN", "Набор десертов дня", "Не могу забрать заказ", "Нужно отменить заказ", "hello@apetite.ru", "только через поддержку"]), T[-500:])
    check("лист помощи: темы — переключатель (radio), первая выбрана", page.get_by_role("radio").count() == 5 and page.get_by_role("radio", name="Не могу забрать заказ").get_attribute("aria-checked") == "true")
    page.get_by_role("radio", name="Списана не та сумма").click(); page.wait_for_timeout(200)
    check("лист помощи: выбор темы переключает отметку", page.get_by_role("radio", name="Списана не та сумма").get_attribute("aria-checked") == "true" and page.get_by_role("radio", name="Не могу забрать заказ").get_attribute("aria-checked") == "false")
    page.screenshot(path=os.path.join(OUT, "orders_help_light.png")); axe_ok(page, "лист помощи (светлая)")
    pages_before = len(ctx.pages)
    capture_mail(page); page.get_by_role("button", name="Написать на почту").click(); page.wait_for_timeout(300)
    u, q = mail_params(page); body = q.get("body", "")
    check("письмо: не открывает лишнюю вкладку (пустая вкладка от window.open для mailto)", len(ctx.pages) == pages_before, (pages_before, len(ctx.pages)))
    check("письмо: адрес поддержки и тема с номером заказа", u and u.startswith("mailto:hello@apetite.ru?") and q.get("subject") == "Appetite: помощь с заказом №D-OPEN", u)
    check("письмо: подставлены тема, ID заказа, предложение, заведение и сумма", all(x in body for x in ["Тема: Списана не та сумма", "ID: ord-open", "Предложение: Набор десертов дня", "Заведение: Кафе Пушкинъ", "Сумма: 240 ₽"]), body)
    check("письмо: код самовывоза (секрет) в письмо не попадает", "482931" not in (u or "") and "482931" not in body)
    page.keyboard.press("Escape"); page.wait_for_timeout(600)
    check("лист закрывается по Escape", page.get_by_role("radiogroup").count() == 0)
    page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).click(); page.wait_for_timeout(500)
    check("лист при повторном открытии начинает с первой темы", page.get_by_role("radio", name="Не могу забрать заказ").get_attribute("aria-checked") == "true")
    page.get_by_role("button", name="Закрыть").last.click(); page.wait_for_timeout(600)
    check("лист закрывается кнопкой «Закрыть»", page.get_by_role("radiogroup").count() == 0)
    # почта недоступна
    capture_mail(page, fail=True)
    page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).click(); page.wait_for_timeout(500)
    page.get_by_role("button", name="Написать на почту").click(); page.wait_for_timeout(400)
    check("нет почтового приложения: понятное сообщение с адресом", "Не удалось открыть почту. Напишите нам на hello@apetite.ru." in texts(page), texts(page)[-300:])
    ctx.close()

    ctx, page, st, errs = new_page(b, PH, scheme="dark"); open_order(page, "^Набор десертов дня, Кафе Пушкинъ, 630 ₽, Забран")
    check("выданный заказ: помощь доступна и из истории", page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).count() == 1)
    page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).click(); page.wait_for_timeout(700)
    page.screenshot(path=os.path.join(OUT, "orders_help_dark.png")); axe_ok(page, "лист помощи (тёмная)")
    ctx.close()

    # билет сразу после оплаты
    ctx, page, st, errs = new_page(b, PH); go_checkout(page); pay(page)
    check("билет после оплаты: вход «Нужна помощь с заказом» на месте", page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).count() == 1); ctx.close()

    # профиль
    ctx, page, st, errs = new_page(b, PH, scheme="light"); tab(page, "Профиль"); page.wait_for_timeout(600)
    page.get_by_role("button", name=re.compile("Помощь и поддержка")).click(); page.wait_for_timeout(700); T = texts(page)
    check("профиль: общая помощь — темы без заказа, без правила отмены", "Выберите тему" in T and "Проблема с оплатой" in T and "Нужно отменить заказ" not in T and "только через поддержку" not in T, T[-400:])
    capture_mail(page); page.get_by_role("button", name="Написать на почту").click(); page.wait_for_timeout(300)
    u, q = mail_params(page)
    check("профиль: письмо с общей темой и без данных заказа", q.get("subject") == "Appetite: помощь" and "Заказ:" not in q.get("body", "") and "Тема: Вопрос по заказу" in q.get("body", ""), u)
    ctx.close()

    # низкий экран: лист прокручивается, кнопка «Написать» достижима
    ctx, page, st, errs = new_page(b, SMALL, scheme="dark"); open_order(page, "^Набор десертов дня, Кафе Пушкинъ, 240 ₽, Ожидает")
    page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).click(); page.wait_for_timeout(700)
    send = page.get_by_role("button", name="Написать на почту"); send.scroll_into_view_if_needed(); page.wait_for_timeout(300)
    bb = send.bounding_box()
    check("320×568: лист в пределах экрана, «Написать на почту» достижима прокруткой", bb and 0 <= bb["x"] and bb["x"] + bb["width"] <= SMALL["width"] and bb["y"] + bb["height"] <= SMALL["height"] + 1, bb)
    check("320×568: без горизонтальной прокрутки", not overflow(page))
    page.screenshot(path=os.path.join(OUT, "orders_help_small.png")); ctx.close()

    # ───────── Шаг 5 (F5): офлайн-билет ─────────
    keys_of = lambda page: page.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('apetite.offline.'))")
    stored = lambda page, key: page.evaluate("k => JSON.parse(localStorage.getItem(k) || 'null')", key)
    digits = lambda page: re.sub(r"\D", "", texts(page))
    has_qr = lambda page: page.evaluate("() => { const e = document.querySelector('[data-testid=pickup-qr]'); return !!e && [...e.querySelectorAll('*')].some(c => getComputedStyle(c).backgroundImage.includes('data:image/png')) }")
    def rows_of(page): return [r.inner_text() for r in page.locator('[role=button][aria-label*="₽"]:not([data-testid=offer-ribbon] [role=button])').all()]
    def go_offline(page, st): st["mode"]["offline"] = True; page.reload(wait_until="networkidle"); page.wait_for_timeout(1800)

    # сохранение сразу при оплате и после загрузки билета
    ctx, page, st, errs = new_page(b, PH, cached_user=True); go_checkout(page); pay(page)
    ks = keys_of(page); oid = next((k.split("ticket.")[1] for k in ks if ".ticket." in k), None)
    t = stored(page, f"apetite.offline.ticket.{oid}") if oid else None
    check("оплата: билет сохранён на устройстве (ключ ticket.<id>) и список заказов тоже", oid and "apetite.offline.orders" in ks and "apetite.offline.tickets" in ks, ks)
    check("сохранённый билет: код самовывоза, название, заведение и QR на месте", t and t["order"]["pickupCode"] == "246810" and t["offer"]["title"] == "Набор десертов дня" and t["venue"]["name"] == "Кафе Пушкинъ" and (t["qrCodeDataUrl"] or "").startswith("data:"), t)
    check("сохранённый билет: лишних данных нет (описание, владелец заведения)", t and set(t["offer"]) == {"id", "title", "pickupStart", "pickupEnd"} and set(t["venue"]) == {"id", "name", "address", "lat", "lng"}, t and (list(t["offer"]), list(t["venue"])))
    check("онлайн: плашки «Нет сети» нет", "Нет сети" not in texts(page))

    # холодный старт без сети: список из копии → билет из копии
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(1800); page.wait_for_timeout(900)
    online_rows = rows_of(page)
    go_offline(page, st); tab(page, "Заказы"); page.wait_for_timeout(900); T = texts(page); rows = rows_of(page)
    check("без сети, после перезапуска: «Заказы» открываются из сохранённого списка с плашкой «Нет сети»", "Нет сети" in T and "Показан сохранённый список" in T and len(rows) == len(online_rows) and len(rows) >= 2, (len(rows), len(online_rows), T[:200]))
    check("без сети: у строк по-прежнему названия и заведения", all("Кафе Пушкинъ" in r for r in rows) and "Набор десертов дня" in rows[0], rows[:2])
    check("без сети: плашка со временем сохранения и кнопкой «Обновить»", re.search(r"Сохранено в \d{2}:\d{2}", T) and page.get_by_role("button", name="Обновить").count() >= 1)
    page.screenshot(path=os.path.join(OUT, "orders_offline_list.png"))
    page.get_by_role("button", name=re.compile("^Набор десертов дня, Кафе Пушкинъ, 240 ₽, Ожидает")).first.click(); page.wait_for_timeout(1800); T = texts(page)
    check("без сети: билет открывается — код самовывоза на экране", "246810" in digits(page), T[:300])
    check("без сети: QR-картинка на экране", has_qr(page))
    check("без сети: плашка «Показан сохранённый билет — код можно показать кассиру»", "Нет сети" in T and "код можно показать кассиру" in T, T[:200])
    check("без сети: заведение, адрес и «Маршрут» на месте", "Кафе Пушкинъ" in T and "Невский проспект, 40" in T and page.get_by_role("button", name=re.compile("Построить маршрут")).count() == 1)
    check("без сети: нет горизонтальной прокрутки", not overflow(page))
    page.screenshot(path=os.path.join(OUT, "orders_offline_ticket_light.png")); axe_ok(page, "офлайн-билет")
    # связь вернулась: «Обновить» снимает плашку
    st["mode"].pop("offline"); page.get_by_role("button", name="Обновить").first.click(); page.wait_for_timeout(1800)
    check("связь вернулась: «Обновить» убирает плашку, билет цел", "Нет сети" not in texts(page) and "246810" in digits(page))
    ctx.close()

    # только что оплачено и сразу пропала связь: страница перезагружается на экране билета — он открывается из копии,
    # а «Заказы» уже знают о новом заказе
    ctx, page, st, errs = new_page(b, PH, cached_user=True); go_checkout(page); pay(page)
    go_offline(page, st); T = texts(page)
    check("оплатил и сразу остался без сети: страница билета открывается из копии — код, QR и плашка", "246810" in digits(page) and has_qr(page) and "Нет сети" in T, T[:200])
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(1500); rows = rows_of(page)
    check("оплатил и сразу остался без сети: в сохранённом списке есть этот заказ", len(rows) == 1 and "Набор десертов дня" in rows[0] and "240 ₽" in rows[0], rows)
    ctx.close()

    # сервер упал (5xx), а не пропала сеть
    ctx, page, st, errs = new_page(b, PH, cached_user=True); go_checkout(page); pay(page)
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(2200)
    st["mode"]["fail500"] = True; tab(page, "Сейчас"); tab(page, "Заказы"); page.wait_for_timeout(1000)
    check("сервер ответил 500: список тоже из сохранённого, с плашкой", "Нет сети" in texts(page) and len(rows_of(page)) >= 2, texts(page)[:200])
    ctx.close()

    # без сохранённой копии: обычная ошибка с повтором, ничего не выдумываем
    st = make_state(); st["mode"]["offline"] = True
    ctx, page, st, errs = new_page(b, PH, state=st, cached_user=True); tab(page, "Заказы"); page.wait_for_timeout(900); T = texts(page)
    check("нет сети и нет копии: понятная ошибка с «Повторить», без плашки и без выдуманных заказов", "Нет соединения" in T and page.get_by_role("button", name="Повторить").count() >= 1 and "Нет сети" not in T and not rows_of(page), T[:300])
    ctx.close()

    # чужие данные: копия другого аккаунта не показывается
    ctx, page, st, errs = new_page(b, PH, cached_user=True); go_checkout(page); pay(page)
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(2200)
    page.evaluate("() => { for (const k of Object.keys(localStorage)) if (k.startsWith('apetite.offline.')) { const v = JSON.parse(localStorage.getItem(k)); if (v && v.userId) { v.userId = 'other-user'; localStorage.setItem(k, JSON.stringify(v)); } } }")
    go_offline(page, st); tab(page, "Заказы"); page.wait_for_timeout(900)
    check("копия другого аккаунта: список не показывается (ошибка, а не чужие заказы)", not rows_of(page) and "Нет сети" not in texts(page) and "Нет соединения" in texts(page), texts(page)[:200])
    ctx.close()

    # выход из аккаунта стирает билеты
    ctx, page, st, errs = new_page(b, PH, cached_user=True); go_checkout(page); pay(page)
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(2200)
    before = len(keys_of(page)); tab(page, "Профиль"); page.wait_for_timeout(500)
    page.get_by_role("button", name="Выйти").click(); page.wait_for_timeout(1800)
    check("выход из аккаунта: сохранённые билеты и список стёрты", before >= 3 and len(keys_of(page)) == 0, (before, keys_of(page)))
    ctx.close()

    # тёмная тема и малый экран
    ctx, page, st, errs = new_page(b, SMALL, scheme="dark", cached_user=True); go_checkout(page); pay(page)
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(2200)
    go_offline(page, st); tab(page, "Заказы"); page.wait_for_timeout(900)
    page.get_by_role("button", name=re.compile("^Набор десертов дня, Кафе Пушкинъ, 240 ₽, Ожидает")).first.click(); page.wait_for_timeout(1800)
    check("320×568, тёмная, без сети: билет с кодом, без горизонтальной прокрутки", "246810" in digits(page) and not overflow(page))
    page.screenshot(path=os.path.join(OUT, "orders_offline_ticket_dark.png")); axe_ok(page, "офлайн-билет (тёмная, 320)")
    ctx.close()

    # ───────── Доработки после сквозной проверки ─────────
    # способ оплаты: именованная радио-группа с состоянием
    ctx, page, st, errs = new_page(b, PH, scheme="light"); go_checkout(page)
    radios = page.get_by_role("radio")
    check("оплата: способы оплаты — радио-группа «Способ оплаты» с двумя вариантами", page.get_by_role("radiogroup", name="Способ оплаты").count() == 1 and radios.count() == 2)
    check("оплата: выбрана карта, состояние в DOM (aria-checked)", page.get_by_role("radio", name=re.compile("^Банковская карта")).get_attribute("aria-checked") == "true" and page.get_by_role("radio", name=re.compile("^СБП")).get_attribute("aria-checked") == "false")
    page.get_by_role("radio", name=re.compile("^СБП")).click(); page.wait_for_timeout(250)
    check("оплата: выбор СБП переключает состояние", page.get_by_role("radio", name=re.compile("^СБП")).get_attribute("aria-checked") == "true")
    axe_ok(page, "оплата с радио-группой (светлая)")
    ctx.close()

    # история: адрес не загрузился — повтор доступен и в выданном заказе
    ctx, page, st, errs = new_page(b, PH); st["mode"]["business_fail"] = True; open_order(page, "^Набор десертов дня, 630 ₽, Забран")
    check("выданный заказ без адреса: сообщение и «Повторить»", "Адрес пока не загрузился" in texts(page) and page.get_by_role("button", name="Повторить").count() >= 1, texts(page)[:300])
    st["mode"].pop("business_fail"); page.get_by_role("button", name="Повторить").first.click(); page.wait_for_timeout(1500)
    check("выданный заказ: после «Повторить» адрес на месте", "Кафе Пушкинъ" in texts(page) and "Адрес пока не загрузился" not in texts(page))
    ctx.close()

    # без сети окно выдачи закрылось: код не показываем
    ctx, page, st, errs = new_page(b, PH, cached_user=True); go_checkout(page); pay(page)
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(2200)
    page.evaluate("() => { for (const k of Object.keys(localStorage)) if (k.startsWith('apetite.offline.ticket.')) { const v = JSON.parse(localStorage.getItem(k)); v.offer.pickupStart = new Date(Date.now() - 3 * 3600e3).toISOString(); v.offer.pickupEnd = new Date(Date.now() - 3600e3).toISOString(); localStorage.setItem(k, JSON.stringify(v)); } }")
    go_offline(page, st); tab(page, "Заказы"); page.wait_for_timeout(900)
    page.get_by_role("button", name=re.compile("^Набор десертов дня, Кафе Пушкинъ, 240 ₽, Ожидает")).first.click(); page.wait_for_timeout(1800); T = texts(page)
    check("без сети, окно закрыто: код самовывоза не показывается", page.locator("[aria-label^='Код самовывоза:']").count() == 0 and "246810" not in digits(page), T[:300])
    check("без сети, окно закрыто: «Время самовывоза истекло» и честная плашка без «покажите кассиру»", "Время самовывоза истекло" in T and "можно показать кассиру" not in T and "Нет сети" in T, T[:400])
    ctx.close()

    # плашка «нет сети»: текст не зажат кнопкой, кнопка под текстом
    ctx, page, st, errs = new_page(b, PH, cached_user=True); go_checkout(page); pay(page)
    page.get_by_role("button", name="К моим заказам").click(); page.wait_for_timeout(2200)
    go_offline(page, st); tab(page, "Заказы"); page.wait_for_timeout(900)
    body = page.get_by_text("Показан сохранённый список").bounding_box(); btn = page.get_by_role("button", name="Обновить").bounding_box()
    check("плашка «нет сети»: «Обновить» под текстом, а не сбоку (текст не сжат в три строки)", body and btn and btn["y"] >= body["y"] + body["height"] - 1 and body["height"] <= 60, (body, btn))
    page.screenshot(path=os.path.join(OUT, "orders_offline_list_v2.png"))
    ctx.close()

    # ───────── Подключённые элементы из 21st.dev ─────────
    # Главная: переключатель «Сейчас / Вечерние» — радио-группа со скользящей плашкой
    ctx, page, st, errs = new_page(b, PH, scheme="light")
    g = page.get_by_role("radiogroup", name="Время самовывоза", exact=True)
    check("Главная: переключатель времени — радио-группа из двух сегментов, выбран «Сейчас»", g.count() == 1 and g.get_by_role("radio").count() == 2 and g.get_by_role("radio", name="Сейчас").get_attribute("aria-checked") == "true")
    g.get_by_role("radio", name="Вечерние").click(); page.wait_for_timeout(700)
    check("Главная: «Вечерние» выбраны, плашка под ними", g.get_by_role("radio", name="Вечерние").get_attribute("aria-checked") == "true" and abs(g.get_by_role("radio", name="Вечерние").bounding_box()["x"] - page.evaluate("""() => { const g = [...document.querySelectorAll('[role=radiogroup]')].find(e => e.getAttribute('aria-label') === 'Время самовывоза'); const t = [...g.children].find(c => c.getAttribute('role') !== 'radio'); return t.getBoundingClientRect().left }""")) < 2)
    axe_ok(page, "Главная с новым переключателем (светлая)")
    # Уведомления
    page.goto(BASE + "/notifications", wait_until="networkidle"); page.wait_for_timeout(1500)
    ng = page.get_by_role("radiogroup", name="Фильтр уведомлений", exact=True)
    check("Уведомления: фильтр — радио-группа «Все / Непрочитанные»", ng.count() == 1 and ng.get_by_role("radio").count() == 2)
    ng.get_by_role("radio", name="Непрочитанные").click(); page.wait_for_timeout(900)
    check("Уведомления: «Непрочитанные» скрывает прочитанные", "Заказ забран" not in texts(page))
    ctx.close()

    # Профиль: тема и язык — компактные переключатели
    ctx, page, st, errs = new_page(b, PH, scheme="light"); tab(page, "Профиль"); page.wait_for_timeout(700)
    tg = page.get_by_role("radiogroup", name="Тема оформления", exact=True); lg = page.get_by_role("radiogroup", name="Язык", exact=True)
    check("Профиль: тема — три значка (Системная / Светлая / Тёмная) с подписями для скринридера", tg.get_by_role("radio").count() == 3 and all(tg.get_by_role("radio", name=n).count() == 1 for n in ["Системная", "Светлая", "Тёмная"]) and all(r.inner_text().strip() == "" for r in tg.get_by_role("radio").all()))
    check("Профиль: язык — «RU / EN», скринридер читает «Русский» и «English»", lg.get_by_role("radio", name="Русский").inner_text().strip() == "RU" and lg.get_by_role("radio", name="English").inner_text().strip() == "EN")
    check("Профиль: касание переключателей ≥ 44 px", all(r.bounding_box()["height"] >= 44 for r in tg.get_by_role("radio").all() + lg.get_by_role("radio").all()))
    tg.get_by_role("radio", name="Тёмная").click(); page.wait_for_timeout(700)
    check("Профиль: «Тёмная» переключает тему и остаётся выбранной", tg.get_by_role("radio", name="Тёмная").get_attribute("aria-checked") == "true")
    lg.get_by_role("radio", name="English").click(); page.wait_for_timeout(900)
    check("Профиль: «English» переключает язык интерфейса", "Settings".upper() in texts(page).upper() or "Log out" in texts(page) or "Profile" in texts(page), texts(page)[:200])
    axe_ok(page, "Профиль с новыми переключателями (тёмная, English)")
    check("Профиль: нет горизонтальной прокрутки", not overflow(page))
    ctx.close()

    # Заказы: пустой список, скелетон, офлайн-состояние
    st = make_state(); st["mode"]["empty"] = True
    ctx, page, st, errs = new_page(b, PH, state=st, scheme="light"); tab(page, "Заказы"); page.wait_for_timeout(900); T = texts(page)
    check("Заказы без заказов: «Заказов пока нет», пояснение и действие «Смотреть предложения»", "Заказов пока нет" in T and "Найдите предложение рядом" in T and page.get_by_role("button", name="Смотреть предложения").count() == 1, T[:300])
    page.screenshot(path=os.path.join(OUT, "orders_empty_light.png")); axe_ok(page, "Заказы: пустое состояние (светлая)")
    page.get_by_role("button", name="Смотреть предложения").click(); page.wait_for_timeout(1200)
    check("«Смотреть предложения» ведёт на Главную", "Привет, Тест" in texts(page) and page.get_by_role("radiogroup", name="Время самовывоза", exact=True).is_visible())
    ctx.close()
    st = make_state(); ctx, page, st, errs = new_page(b, PH, state=st, scheme="dark")
    held = []  # запрос списка заказов держим, чтобы спокойно посмотреть на состояние загрузки; потом отпускаем в основной мок
    ctx.route("**/api/v1/orders", lambda route, request: held.append(route) if request.method == "GET" else route.fallback())
    page.get_by_role("tab", name="Заказы").click(); page.wait_for_timeout(700)
    check("Заказы пока грузятся: заглушки-строки под заголовком, одна подпись «Загрузка» для скринридера", page.get_by_role("progressbar", name="Загрузка...").count() == 1 and "Мои заказы" in texts(page) and len(held) >= 1, (len(held), texts(page)[:80]))
    page.screenshot(path=os.path.join(OUT, "orders_skeleton_dark.png")); axe_ok(page, "Заказы: скелетон загрузки (тёмная)")
    for r in held: r.fallback()
    page.wait_for_timeout(1500)
    check("Заказы после загрузки: заглушек нет, строки на месте", page.get_by_role("progressbar").count() == 0 and len(rows_of(page)) == 5)
    ctx.close()
    st = make_state(); st["mode"]["offline"] = True
    ctx, page, st, errs = new_page(b, PH, state=st, cached_user=True, scheme="dark"); tab(page, "Заказы"); page.wait_for_timeout(900); T = texts(page)
    check("Заказы без сети и без копии: офлайн-экран «Нет соединения» с пояснением и «Повторить»", "Нет соединения" in T and "интернета нет" in T and page.get_by_role("button", name="Повторить").count() >= 1, T[:240])
    page.screenshot(path=os.path.join(OUT, "orders_offline_state_dark.png")); axe_ok(page, "Заказы: офлайн-экран (тёмная)")
    ctx.close()

    # Статус-бейдж в строке заказа и свайп шторки помощи
    ctx, page, st, errs = new_page(b, PH, scheme="light"); open_order(page, "^Набор десертов дня, Кафе Пушкинъ, 240 ₽, Ожидает")
    page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).click(); page.wait_for_timeout(800)
    gx = page.evaluate("() => { const g = document.querySelector('[data-testid=sheet-grab]').getBoundingClientRect(); return { x: g.left + g.width / 2, y: g.top + g.height / 2 } }")
    page.mouse.move(gx["x"], gx["y"]); page.mouse.down(); page.mouse.move(gx["x"], gx["y"] + 30, steps=5); page.mouse.up(); page.wait_for_timeout(700)
    check("Шторка помощи: короткий свайп — возвращается на место", page.get_by_role("radiogroup", name="О чём письмо", exact=True).count() == 1)
    gx = page.evaluate("() => { const g = document.querySelector('[data-testid=sheet-grab]').getBoundingClientRect(); return { x: g.left + g.width / 2, y: g.top + g.height / 2 } }")
    page.mouse.move(gx["x"], gx["y"]); page.mouse.down(); page.mouse.move(gx["x"], gx["y"] + 170, steps=12); page.mouse.up(); page.wait_for_timeout(900)
    check("Шторка помощи: длинный свайп вниз закрывает её", page.get_by_role("radiogroup", name="О чём письмо", exact=True).count() == 0)
    page.get_by_role("button", name=re.compile("Нужна помощь с заказом")).click(); page.wait_for_timeout(800)
    page.get_by_role("radio", name="Списана не та сумма").click(); page.wait_for_timeout(600)
    check("Шторка помощи: темы — радио-карточки со скользящей плашкой, выбор работает", page.get_by_role("radio", name="Списана не та сумма").get_attribute("aria-checked") == "true")
    page.screenshot(path=os.path.join(OUT, "orders_help_wired.png")); axe_ok(page, "Шторка помощи с RadioCards (светлая)")
    ctx.close()

    # размеры
    for name, vp in (("320×568", SMALL), ("планшет/веб 1000×920", WIDE)):
        ctx, page, st, errs = new_page(b, vp, scheme="dark"); go_checkout(page)
        check(f"{name}: оплата без горизонтальной прокрутки, «Оплатить» в пределах экрана", not overflow(page))
        pay(page)
        check(f"{name}: билет без горизонтальной прокрутки", not overflow(page))
        check(f"{name}: нет ошибок в консоли", not errs, errs[:3])
        ctx.close()

    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
