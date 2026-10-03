import os
"""QA форм сайта на замоканном API (регистрация, вход, заявка бизнеса): реальный backend не задействован."""
import json, re, sys
from playwright.sync_api import sync_playwright
BASE = "http://localhost:5174"
results = []
def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail else "") if not cond else "[PASS] " + name)

USER = {"id": "u1", "email": "qa@example.test", "name": "QA", "role": "USER", "notifyRadiusKm": 5, "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z"}
FAKE_PASSWORD = "Qa-Fake-Pass-1!"  # заведомо фиктивный: уходит только в замоканный API

def new(b, vp, mode):
    ctx = b.new_context(viewport=vp, reduced_motion="reduce", locale="ru-RU"); calls = []
    def handler(route, request):
        if request.method == "OPTIONS": return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
        path = re.sub(r"^https?://[^/]+/api/v1", "", request.url); calls.append((request.method, path, request.post_data))
        def ok(d, s=200): route.fulfill(status=s, content_type="application/json", body=json.dumps(d), headers={"access-control-allow-origin": "*"})
        if mode.get("offline"): return route.abort("connectionrefused")
        if mode.get("slow"): import time; time.sleep(mode["slow"])
        if path == "/auth/login": return ok({"accessToken": "a", "refreshToken": "r", "user": USER}, 201) if not mode.get("login_fail") else ok({"statusCode": 401, "message": "Неверный email/телефон или пароль"}, 401)
        if path == "/auth/register":
            if mode.get("register_status"): return ok({"statusCode": mode["register_status"], "message": "Пользователь с таким email уже существует" if mode["register_status"] == 409 else "Внутренняя ошибка сервера"}, mode["register_status"])
            return ok({"accessToken": "a", "refreshToken": "r", "user": USER}, 201)
        if path == "/auth/otp/request": return ok({"success": True}, 201)
        if path == "/auth/otp/verify": return ok({"verified": True}, 201) if not mode.get("otp_bad") else ok({"statusCode": 400, "message": "Неверный код"}, 400)
        if path == "/business-applications":
            if mode.get("app_status"): return ok({"statusCode": mode["app_status"], "message": "Внутренняя ошибка сервера"}, mode["app_status"])
            return ok({"id": "app1"}, 201)
        return ok({"statusCode": 404, "message": "unmocked " + path}, 404)
    ctx.route("**/api/v1/**", handler); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(m.text[:140]) if m.type == "error" and not re.search("Failed to load resource|ERR_CONNECTION", m.text) else None)
    return ctx, page, calls, errs
D = {"width": 1414, "height": 900}; PH = {"width": 390, "height": 844}
body = lambda page: page.inner_text("body")

with sync_playwright() as p:
    b = getattr(p, os.environ.get("QA_BROWSER", "chromium")).launch()
    for label, vp in [("phone", PH), ("desktop", D)]:
        # ---------- login ----------
        mode = {}; ctx, page, calls, errs = new(b, vp, mode); page.goto(BASE + "/login", wait_until="networkidle")
        page.get_by_label("Email").fill("qa@example.test"); page.get_by_label("Пароль").fill(FAKE_PASSWORD)
        btn = page.locator("button[type=submit]").last; check(f"[{label}] login: кнопка активна после заполнения", btn.is_enabled())
        btn.dblclick(); page.wait_for_timeout(1200)
        check(f"[{label}] login: двойной клик отправляет один запрос", len([c for c in calls if c[1] == "/auth/login"]) == 1, str(len(calls)))
        check(f"[{label}] login: успех ведёт на карту предложений", "/map" in page.url, page.url)
        ctx.close()
        mode = {"login_fail": True}; ctx, page, calls, errs = new(b, vp, mode); page.goto(BASE + "/login", wait_until="networkidle")
        page.get_by_label("Email").fill("qa@example.test"); page.get_by_label("Пароль").fill("wrong"); page.locator("button[type=submit]").last.click(); page.wait_for_timeout(900)
        check(f"[{label}] login: неверные данные -> сообщение сервера, форма остаётся", "Неверный email/телефон или пароль" in body(page) and page.get_by_label("Email").is_visible())
        ctx.close()
        mode = {"offline": True}; ctx, page, calls, errs = new(b, vp, mode); page.goto(BASE + "/login", wait_until="networkidle")
        page.get_by_label("Email").fill("qa@example.test"); page.get_by_label("Пароль").fill(FAKE_PASSWORD); page.locator("button[type=submit]").last.click(); page.wait_for_timeout(900)
        check(f"[{label}] login: без сети — понятная ошибка, не «Failed to fetch»", "Нет соединения с сервером" in body(page) and "Failed to fetch" not in body(page), body(page)[-160:].replace("\n", " "))
        ctx.close()
        # ---------- register ----------
        mode = {}; ctx, page, calls, errs = new(b, vp, mode); page.goto(BASE + "/register", wait_until="networkidle")
        page.get_by_label("Имя").fill("Я"); page.get_by_label("Имя").blur(); page.get_by_label("Email", exact=True).fill("bad"); page.get_by_label("Email", exact=True).blur()
        pw = page.locator("#reg-password"); pw.fill("abc"); pw.blur(); page.locator("#confirm-password").fill("xyz"); page.locator("#confirm-password").blur(); page.wait_for_timeout(300)
        T = body(page)
        check(f"[{label}] register: подсказки валидации имени, email, паролей", all(x in T for x in ["Минимум 2 символа", "Некорректный email", "Пароли не совпадают"]), T[:300].replace("\n", " "))
        check(f"[{label}] register: submit заблокирован при невалидной форме", page.locator("button[type=submit]").last.is_disabled())
        page.get_by_label("Имя").fill("QA Tester"); page.get_by_label("Email", exact=True).fill("qa@example.test"); pw.fill(FAKE_PASSWORD); page.locator("#confirm-password").fill(FAKE_PASSWORD)
        page.wait_for_timeout(300); sub = page.locator("button[type=submit]").last
        check(f"[{label}] register: валидная форма активирует кнопку", sub.is_enabled())
        sub.dblclick(); page.wait_for_timeout(1200)
        reg = [c for c in calls if c[1] == "/auth/register"]
        check(f"[{label}] register: двойной клик = один запрос", len(reg) == 1, str(len(reg)))
        check(f"[{label}] register: в запрос не попадает подтверждение пароля", reg and "confirm" not in (reg[0][2] or "").lower(), (reg[0][2] if reg else "")[:120])
        ctx.close()
        for code, expect in [(409, "уже существует"), (500, "Внутренняя ошибка")]:
            mode = {"register_status": code}; ctx, page, calls, errs = new(b, vp, mode); page.goto(BASE + "/register", wait_until="networkidle")
            page.get_by_label("Имя").fill("QA Tester"); page.get_by_label("Email", exact=True).fill("qa@example.test"); page.locator("#reg-password").fill(FAKE_PASSWORD); page.locator("#confirm-password").fill(FAKE_PASSWORD)
            page.locator("button[type=submit]").last.click(); page.wait_for_timeout(1000)
            check(f"[{label}] register: ответ {code} показан пользователем", expect in body(page), body(page)[-140:].replace("\n", " ")); ctx.close()
        # ---------- заявка бизнеса ----------
        def fill_business(page, name="Кафе Тест"):
            page.get_by_label("Название заведения").fill(name); page.get_by_label("Адрес").fill("Невский проспект, 1"); page.get_by_label("Контактное лицо").fill("Иван Иванов")
            page.locator("#biz-email").fill("biz@example.test"); page.locator("#biz-phone").fill("+79991234567")
            cb = page.locator("input[type=checkbox]").first
            if not cb.is_checked(): cb.check()
        mode = {}; ctx, page, calls, errs = new(b, vp, mode); page.goto(BASE + "/for-business", wait_until="networkidle")
        page.get_by_label("Название заведения").fill("К"); page.get_by_label("Название заведения").blur(); page.locator("#biz-email").fill("bad"); page.locator("#biz-email").blur(); page.wait_for_timeout(200)
        check(f"[{label}] заявка: подсказки валидации", "Минимум 2 символа" in body(page) and "Некорректный email" in body(page))
        fill_business(page); page.wait_for_timeout(300); sub = page.locator("button[type=submit]").last
        check(f"[{label}] заявка: submit активен только при согласии с офертой и валидных полях", sub.is_enabled())
        page.locator("input[type=checkbox]").first.uncheck(); check(f"[{label}] заявка: без согласия с офертой submit заблокирован", sub.is_disabled()); page.locator("input[type=checkbox]").first.check()
        sub.dblclick(); page.wait_for_timeout(1200)
        check(f"[{label}] заявка: двойной клик = один POST", len([c for c in calls if c[1] == "/business-applications"]) == 1, str(len(calls)))
        check(f"[{label}] заявка: успех -> «Заявка отправлена!»", "Заявка отправлена" in body(page))
        payload = next((json.loads(c[2]) for c in calls if c[1] == "/business-applications"), {})
        check(f"[{label}] заявка: ofertaAccepted=true уходит на сервер", payload.get("ofertaAccepted") is True, str(payload))
        ctx.close()
        for name, m, expect in [("500", {"app_status": 500}, "Внутренняя ошибка"), ("офлайн", {"offline": True}, "Нет соединения с сервером")]:
            ctx, page, calls, errs = new(b, vp, m); page.goto(BASE + "/for-business", wait_until="networkidle"); fill_business(page); page.wait_for_timeout(300)
            page.locator("button[type=submit]").last.click(); page.wait_for_timeout(1000)
            check(f"[{label}] заявка ({name}): понятная ошибка, форма сохраняет ввод", expect in body(page) and page.get_by_label("Название заведения").input_value() == "Кафе Тест", body(page)[-160:].replace("\n", " ")); ctx.close()
        check(f"[{label}] формы: нет JS-ошибок", not errs, str(errs[:3]))
    b.close()
print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
