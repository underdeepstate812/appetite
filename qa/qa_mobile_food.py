"""QA мобильного приложения на ЗАМОКАННОМ API: состав/аллергены/срок годности до оплаты и подтверждение получения покупателем.
Сеть и пароли не нужны. Запуск: python3 qa/qa_mobile_food.py (нужен mobile-web на :8081)."""
import json, os, re, sys, tempfile
from playwright.sync_api import sync_playwright

QA = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(QA, "qa_mobile_orders.py")).read().split("\nwith sync_playwright() as p:")[0])  # make_state, new_page, cards, tab, check, iso, axe_ok, go_checkout, pay …
OUT = os.environ.get("QA_OUT", tempfile.gettempdir())

def open_offer(page, title):
    cards(page).filter(has_text=title).first.click(); page.wait_for_timeout(1500)
def open_order(page, name):
    tab(page, "Заказы"); page.wait_for_timeout(900)
    page.get_by_role("button", name=re.compile(name)).first.click(); page.wait_for_timeout(1500)
def legacy_state():
    st = make_state()  # «Бизнес-ланч» — старый оффер без состава (до появления поля)
    st["offers"][1].update({"ingredients": None, "allergens": [], "allergensDeclared": False, "bestBefore": None})
    return st
DONE = "^Набор десертов дня, Кафе Пушкинъ, 630 ₽, Забран"
def y_of(page, text): return page.get_by_text(text, exact=False).first.bounding_box()["y"]

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ───────── экран оффера ─────────
    ctx, page, st, errs = new_page(b, PH, scheme="light"); open_offer(page, "Набор десертов дня"); T = texts(page)
    check("оффер: блок «Состав и срок годности» с составом, аллергенами по именам и «Годен до»", all(x in T for x in ["Мука, вода, сыр, томаты", "глютен (злаки)", "молоко и лактоза"]) and "СОСТАВ И СРОК ГОДНОСТИ" in T.upper() and re.search(r"Годен до \d", T), T[:500])
    check("оффер: аллергены читаются скринридером одним списком", page.get_by_label("Аллергены: глютен (злаки), молоко и лактоза").count() >= 1)
    check("оффер: блок состава стоит ВЫШЕ «времени на самовывоз» (виден до покупки, а не в конце)", y_of(page, "Состав и срок годности".upper()) < y_of(page, "ВРЕМЯ НА САМОВЫВОЗ"), None)
    page.screenshot(path=os.path.join(OUT, "food_offer_light.png")); axe_ok(page, "экран оффера с составом (светлая)")
    ctx.close()
    ctx, page, st, errs = new_page(b, PH, scheme="dark"); open_offer(page, "Набор десертов дня")
    page.screenshot(path=os.path.join(OUT, "food_offer_dark.png")); axe_ok(page, "экран оффера с составом (тёмная)"); ctx.close()
    ctx, page, st, errs = new_page(b, PH, state=legacy_state(), scheme="light"); open_offer(page, "Бизнес-ланч"); T = texts(page)
    check("старый оффер без состава: прямо сказано «Заведение не указало состав и аллергены. Уточните…», а не «аллергенов нет»", "Заведение не указало состав и аллергены. Уточните у заведения до покупки." in T and "Аллергенов нет" not in T, T[:400])
    check("старый оффер: купить всё равно можно (решение за покупателем), кнопка «Купить» доступна", page.get_by_role("button", name="Купить").is_enabled())
    axe_ok(page, "старый оффер без состава (светлая)"); ctx.close()
    ctx, page, st, errs = new_page(b, PH); open_offer(page, "Букеты, требующие обновления")
    check("цветы: блока состава нет", "СОСТАВ И СРОК ГОДНОСТИ" not in texts(page).upper()); ctx.close()
    ctx, page, st, errs = new_page(b, SMALL, scheme="dark"); open_offer(page, "Набор десертов дня")
    check("320×568: экран оффера с составом без горизонтальной прокрутки", not overflow(page)); page.screenshot(path=os.path.join(OUT, "food_offer_small.png")); ctx.close()

    # ───────── оплата ─────────
    ctx, page, st, errs = new_page(b, PH, scheme="light"); go_checkout(page); T = texts(page)
    check("оплата: в сводке аллергены и срок годности — перед кнопкой «Оплатить»", "Аллергены: глютен (злаки), молоко и лактоза" in T and re.search(r"Годен до \d", T), T[:500])
    check("оплата: строка аллергенов выше итога и кнопки", y_of(page, "Аллергены:") < y_of(page, "Итого") < page.get_by_role("button", name="Оплатить").bounding_box()["y"])
    page.screenshot(path=os.path.join(OUT, "food_checkout_light.png")); axe_ok(page, "оплата с составом (светлая)"); ctx.close()
    ctx, page, st, errs = new_page(b, PH, state=legacy_state()); go_checkout(page, "Бизнес-ланч"); T = texts(page)
    check("оплата старого оффера: «Состав и аллергены не указаны — уточните у заведения», оплата не блокируется", "Состав и аллергены не указаны — уточните у заведения" in T and page.get_by_role("button", name="Оплатить").is_enabled(), T[:300]); ctx.close()

    # ───────── подтверждение получения ─────────
    ctx, page, st, errs = new_page(b, PH, scheme="light"); tab(page, "Заказы"); page.wait_for_timeout(900)
    rows = [r.inner_text() for r in page.locator('[role=button][aria-label*="₽"]:not([data-testid=offer-ribbon] [role=button])').all()]
    check("список заказов: у выданного заказа напоминание «Подтвердите получение», у остальных нет", sum("Подтвердите получение" in r for r in rows) == 1 and "Забран" in [r for r in rows if "Подтвердите получение" in r][0], rows)
    page.get_by_role("button", name=re.compile(DONE)).first.click(); page.wait_for_timeout(1500); T = texts(page)
    check("выданный заказ: вопрос «Вы получили заказ?» с кнопками «Да, получил» / «Нет, не получил»", "Вы получили заказ?" in T and page.get_by_role("button", name="Да, получил").count() == 1 and page.get_by_role("button", name="Нет, не получил").count() == 1, T[:300])
    page.screenshot(path=os.path.join(OUT, "food_receipt_light.png")); axe_ok(page, "вопрос о получении (светлая)")
    page.get_by_role("button", name="Да, получил").click(); page.wait_for_timeout(1200)
    check("«Да, получил»: на сервер ушло received=true, на экране «Получение подтверждено»", st.get("receipt_calls") == [{"received": True}] and "Получение подтверждено" in texts(page) and "Вы получили заказ?" not in texts(page), st.get("receipt_calls"))
    back(page); page.wait_for_timeout(1200)
    tab(page, "Заказы"); page.wait_for_timeout(900)
    check("после подтверждения напоминание в списке исчезло", "Подтвердите получение" not in " ".join(r.inner_text() for r in page.locator('[role=button][aria-label*="₽"]:not([data-testid=offer-ribbon] [role=button])').all()))
    ctx.close()

    ctx, page, st, errs = new_page(b, PH, scheme="dark"); open_order(page, DONE)
    page.get_by_role("button", name="Нет, не получил").click(); page.wait_for_timeout(800)
    check("«Нет, не получил»: шторка с причинами, ничего ещё не отправлено", page.get_by_text("Что пошло не так?").count() == 1 and page.get_by_role("radio").count() == 4 and not st.get("receipt_calls"))
    check("причины: по умолчанию «Заказ не выдали»", page.get_by_role("radio", name="Заказ не выдали").get_attribute("aria-checked") == "true")
    page.screenshot(path=os.path.join(OUT, "food_dispute_dark.png")); axe_ok(page, "шторка причин спора (тёмная)")
    page.get_by_role("radio", name="Выдали не то").click(); page.wait_for_timeout(500)
    st["mode"]["receipt_fail"] = 409; page.get_by_role("button", name="Отправить").click(); page.wait_for_timeout(900)
    check("сервер отказал (409): сообщение сервера на экране, шторка остаётся", "Ты уже ответил по этому заказу" in texts(page) and page.get_by_text("Что пошло не так?").count() == 1)
    st["mode"].pop("receipt_fail"); page.get_by_role("button", name="Отправить").click(); page.wait_for_timeout(1200)
    last = st["receipt_calls"][-1]
    check("повтор: ушёл спор с причиной WRONG_ITEM", last == {"received": False, "reason": "WRONG_ITEM"}, last)
    check("после спора «Обращение отправлено», вопрос и шторка пропали", "Обращение отправлено" in texts(page) and "Вы получили заказ?" not in texts(page) and page.get_by_text("Что пошло не так?").count() == 0)
    ctx.close()

    ctx, page, st, errs = new_page(b, PH); open_order(page, DONE)
    st["mode"]["offline"] = True; page.get_by_role("button", name="Да, получил").click(); page.wait_for_timeout(1200)
    check("нет сети при ответе: «Не удалось отправить. Попробуйте ещё раз.», вопрос остаётся", "Не удалось отправить. Попробуйте ещё раз." in texts(page) and page.get_by_role("button", name="Да, получил").count() == 1)
    st["mode"].pop("offline"); page.get_by_role("button", name="Да, получил").click(); page.wait_for_timeout(1200)
    check("связь вернулась: повторная отправка проходит", "Получение подтверждено" in texts(page)); ctx.close()

    ctx, page, st, errs = new_page(b, PH); open_order(page, "^Набор десертов дня, Кафе Пушкинъ, 240 ₽, Ожидает")
    check("активный заказ: вопроса о получении нет (заведение ещё не выдало)", "Вы получили заказ?" not in texts(page)); ctx.close()

    ctx, page, st, errs = new_page(b, SMALL, scheme="dark"); open_order(page, DONE)
    check("320×568: экран выданного заказа с вопросом без горизонтальной прокрутки", not overflow(page)); page.screenshot(path=os.path.join(OUT, "food_receipt_small.png")); ctx.close()
    b.close()

print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
