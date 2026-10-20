import os
import re, sys
from playwright.sync_api import sync_playwright
BASE = "http://localhost:5173"
results = []
def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))
with sync_playwright() as p:
    b = getattr(p, os.environ.get("QA_BROWSER", "chromium")).launch()
    for label, vp in [("phone", {"width": 390, "height": 844}), ("tablet", {"width": 768, "height": 1024}), ("desktop", {"width": 1414, "height": 900})]:
        ctx = b.new_context(viewport=vp); page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in m.text and "ERR_CONNECTION_REFUSED" not in m.text else None)
        for path in ["/", "/offers", "/orders", "/analytics", "/platform/businesses", "/platform/stats", "/nope"]:
            page.goto(BASE + path, wait_until="networkidle"); check(f"[{label}] аноним {path} -> /login", page.url.rstrip("/").endswith("/login"), page.url)
        page.goto(BASE + "/login", wait_until="networkidle")
        check(f"[{label}] login: нет горизонтального переполнения", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        check(f"[{label}] login: у всех полей есть label", page.evaluate("[...document.querySelectorAll('input')].every(i => i.getAttribute('aria-label') || (i.id && document.querySelector('label[for=\"'+i.id+'\"]')) || i.closest('label'))"))
        check(f"[{label}] login: у пароля есть autocomplete", (page.locator("input[type=password]").get_attribute("autocomplete") or "") != "")
        check(f"[{label}] login: есть h1", page.locator("h1").count() >= 1)
        if label == "desktop":
            page.route("**/api/v1/**", lambda r: r.abort("connectionrefused"))
            page.locator("input[type=email]").fill("qa@example.invalid"); page.locator("input[type=password]").fill("not-a-real-password")
            page.locator("button[type=submit]").click(); page.wait_for_timeout(1200)
            check("[desktop] login: при недоступном API — понятная ошибка, а не сырое «Failed to fetch»", "failed to fetch" not in page.inner_text("body").lower())
            page.unroute("**/api/v1/**")
        check(f"[{label}] нет JS-ошибок", not errors, str(errors[:3])); ctx.close()
    b.close()
print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
