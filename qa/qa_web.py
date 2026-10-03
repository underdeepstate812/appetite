import os
import re, sys
from playwright.sync_api import sync_playwright
BASE = "http://localhost:5174"
results = []
def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))
with sync_playwright() as p:
    b = getattr(p, os.environ.get("QA_BROWSER", "chromium")).launch()
    for label, vp in [("phone", {"width": 390, "height": 844}), ("desktop", {"width": 1414, "height": 900})]:
        ctx = b.new_context(viewport=vp, reduced_motion="reduce"); page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in m.text else None)
        page.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 and "favicon" not in r.url else None)
        page.goto(BASE + "/", wait_until="networkidle")
        check(f"[{label}] лендинг: h1 и title", page.locator("h1").first.is_visible() and len(page.title()) > 5)
        hashes = page.eval_on_selector_all("a[href^='#']", "els => els.map(e => e.getAttribute('href'))")
        check(f"[{label}] все #якоря ведут на существующие блоки", not [h for h in set(hashes) if len(h) > 1 and page.locator(h).count() == 0])
        for href in ["/register", "/for-business", "/login"]: check(f"[{label}] ссылка на {href}", page.locator(f"a[href='{href}']").count() > 0)
        chips = page.locator(".ribbon-filter"); before = page.locator(".offer-tile").count()
        chips.filter(has_text="Цветы").first.click(); page.wait_for_timeout(500)
        after = page.locator(".offer-tile").count(); chips.filter(has_text="Все").first.click()
        check(f"[{label}] фильтр категории меняет ленту ({before}->{after})", after < before)
        if label == "phone":
            hs = page.evaluate("[...document.querySelectorAll('.ribbon-filter')].map(e => Math.round(e.getBoundingClientRect().height))")
            check("[phone] чипы фильтров ≥ 44px по высоте (цель касания)", hs and min(hs) >= 44, str(hs))
        page.evaluate("document.querySelector('.ribbon-scroll').scrollIntoView({block:'center'})"); page.wait_for_timeout(400)
        for i in range(6):
            like = page.locator(".offer-tile-like").nth(i); bx = like.bounding_box()
            if bx and 10 < bx["x"] < vp["width"] - 60: break
        bx = like.bounding_box(); pre = like.get_attribute("aria-pressed")
        page.mouse.click(bx["x"] + bx["width"] / 2, bx["y"] + bx["height"] / 2); page.wait_for_timeout(250)
        check(f"[{label}] «в избранное» реально переключается по клику мыши", pre == "false" and like.get_attribute("aria-pressed") == "true")
        page.keyboard.press("Tab"); page.keyboard.press("Tab")
        check(f"[{label}] Tab фокусирует элемент с видимым фокусом", page.evaluate("(() => { const a = document.activeElement; if (!a || a === document.body) return false; const s = getComputedStyle(a); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; })()"))
        if label == "phone":
            burger = page.locator("button[aria-expanded]").first
            burger.click(); page.wait_for_timeout(500); check("[phone] гамбургер открывает меню", burger.get_attribute("aria-expanded") == "true")
            page.keyboard.press("Escape"); page.wait_for_timeout(400); check("[phone] Esc закрывает меню", burger.get_attribute("aria-expanded") == "false")
            burger.click(); page.wait_for_timeout(400); page.mouse.click(10, 600); page.wait_for_timeout(400); check("[phone] клик вне меню закрывает его", burger.get_attribute("aria-expanded") == "false")
            burger.click(); page.wait_for_timeout(400); page.locator(".mobile-menu a[href='/login']").first.click(); page.wait_for_timeout(600)
            check("[phone] ссылка в меню ведёт на /login и закрывает меню", page.url.endswith("/login") and burger.get_attribute("aria-expanded") == "false")
        page.goto(BASE + "/login", wait_until="networkidle")
        check(f"[{label}] /login: кнопка «Войти» заблокирована пока форма пуста", page.get_by_role("button", name=re.compile("Войти")).last.is_disabled())
        page.goto(BASE + "/register", wait_until="networkidle"); check(f"[{label}] /register: submit заблокирован пока форма пуста", page.locator("button[type=submit]").last.is_disabled())
        page.goto(BASE + "/for-business", wait_until="networkidle")
        combo = page.locator("[role=combobox]").first; combo.focus(); page.keyboard.press("Enter"); page.wait_for_timeout(300)
        check(f"[{label}] select: Enter открывает список", page.locator("[role=listbox]").is_visible())
        page.keyboard.press("ArrowDown"); page.keyboard.press("Enter"); page.wait_for_timeout(300); check(f"[{label}] select: ↓+Enter выбирает и закрывает", not page.locator("[role=listbox]").is_visible())
        combo.focus(); page.keyboard.press("Space"); page.wait_for_timeout(200); page.keyboard.press("Escape"); page.wait_for_timeout(200); check(f"[{label}] select: Esc закрывает", not page.locator("[role=listbox]").is_visible())
        check(f"[{label}] /for-business: submit заблокирован пока обязательные поля пусты", page.locator("button[type=submit]").last.is_disabled())
        page.goto(BASE + "/legal/oferta", wait_until="networkidle"); check(f"[{label}] оферта: текст отрисован", len(page.inner_text("body")) > 2000)
        titles = set()
        for path in ["/", "/login", "/register", "/for-business", "/legal/oferta"]:
            page.goto(BASE + path, wait_until="networkidle"); titles.add(page.title())
        check(f"[{label}] у страниц разные <title>", len(titles) > 1, f"{len(titles)} уникальных")
        page.goto(BASE + "/no-such-page", wait_until="networkidle")
        check(f"[{label}] неизвестный URL показывает 404", re.search("404|не найден|не существует", page.inner_text("body"), re.I) is not None)
        check(f"[{label}] нет JS-ошибок и 4xx/5xx-запросов", not errors, str(errors[:3])); ctx.close()
    b.close()
print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
