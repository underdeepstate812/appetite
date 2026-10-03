import os
"""Автоматический a11y-аудит (axe-core, WCAG 2.1 A/AA) по сайту, админке и мобильному web на замоканном API."""
import re, sys
from collections import defaultdict
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import sync_playwright

TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
axe = Axe()
report = defaultdict(lambda: {"impact": "", "help": "", "nodes": 0, "where": set(), "samples": []})

def scan(page, where):
    res = axe.run(page, options={"runOnly": {"type": "tag", "values": TAGS}})
    for v in res.response["violations"]:
        r = report[v["id"]]; r["impact"] = v["impact"]; r["help"] = v["help"]; r["nodes"] += len(v["nodes"]); r["where"].add(where)
        for n in v["nodes"][:2]:
            if len(r["samples"]) < 3: r["samples"].append((where, n["target"][0] if n["target"] else "", (n.get("failureSummary") or "")[:170].replace("\n", " ")))
    return len(res.response["violations"])

def load_mod(path):
    src = open(path).read().split("with sync_playwright() as p:")[0]; ns = {}; exec(src, ns); return ns

with sync_playwright() as p:
    b = getattr(p, os.environ.get("QA_BROWSER", "chromium")).launch()
    # ---- сайт ----
    for label, vp in [("phone", {"width": 390, "height": 844}), ("desktop", {"width": 1414, "height": 900})]:
        ctx = b.new_context(viewport=vp, reduced_motion="reduce"); page = ctx.new_page()
        for path in ["/", "/login", "/register", "/for-business", "/legal/oferta", "/no-such-page"]:
            page.goto("http://localhost:5174" + path, wait_until="networkidle"); page.wait_for_timeout(700)
            n = scan(page, f"web {label} {path}"); print(f"web {label} {path}: {n} rule(s)")
        ctx.close()
    # ---- админка ----
    A = load_mod("qa/qa_admin_panels.py")
    for label, vp in [("phone", A["PH"]), ("desktop", A["D"])]:
        ctx = b.new_context(viewport=vp); page = ctx.new_page(); page.goto("http://localhost:5173/login", wait_until="networkidle")
        print(f"admin {label} /login: {scan(page, f'admin {label} /login')} rule(s)"); ctx.close()
        for path, role in [("/offers", "BUSINESS"), ("/orders", "BUSINESS"), ("/analytics", "BUSINESS"), ("/platform/businesses", "ADMIN"), ("/platform/stats", "ADMIN")]:
            ctx, page, st, errs, d = A["open_panel"](b, role, vp, path); print(f"admin {label} {path}: {scan(page, f'admin {label} {path}')} rule(s)"); ctx.close()
    # ---- мобильный web ----
    M = load_mod("qa/qa_mobile.py")
    for scheme in ("dark", "light"):
        for label, vp in [("phone", M["PH"]), ("desktop", {"width": 1414, "height": 900})]:
            ctx, page, st, errs = M["new_page"](b, vp, scheme)
            for name in ["Сейчас", "Карта", "Заказы", "Эко", "Профиль"]:
                M["tab"](page, name); print(f"mobile {scheme} {label} {name}: {scan(page, f'mobile {scheme} {label} {name}')} rule(s)")
            if label == "phone":
                page.goto("http://localhost:8081/notifications"); page.wait_for_timeout(1800); print(f"mobile {scheme} Уведомления: {scan(page, f'mobile {scheme} notifications')} rule(s)")
                page.goto("http://localhost:8081/orders/ord-open"); page.wait_for_timeout(2200); print(f"mobile {scheme} Заказ: {scan(page, f'mobile {scheme} order')} rule(s)")
                page.goto("http://localhost:8081/offers/off-1"); page.wait_for_timeout(1800); print(f"mobile {scheme} Оффер: {scan(page, f'mobile {scheme} offer')} rule(s)")
                page.goto("http://localhost:8081/offers/off-1/checkout"); page.wait_for_timeout(1800); print(f"mobile {scheme} Оплата: {scan(page, f'mobile {scheme} checkout')} rule(s)")
            ctx.close()
    b.close()

print("\n=== СВОДКА ПО ПРАВИЛАМ ===")
order = {"critical": 0, "serious": 1, "moderate": 2, "minor": 3}
for rid, r in sorted(report.items(), key=lambda kv: (order.get(kv[1]["impact"], 9), -kv[1]["nodes"])):
    print(f"[{r['impact']}] {rid}: {r['help']} — {r['nodes']} узл., {len(r['where'])} стр.")
    for w, t, s in r["samples"]: print(f"     · {w} | {t} | {s}")
