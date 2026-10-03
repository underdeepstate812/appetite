"""Сквозной сценарий веб-версии на РЕАЛЬНОМ backend (нужен seed): карта -> оффер -> вход -> оплата -> билет -> заказы -> выход.
Веб должен ходить в API на localhost, напр.: VITE_API_BASE_URL=http://localhost:3000/api/v1 pnpm --filter @apetite/web exec vite --port 5190
и WEB_URL=http://localhost:5190 python3 qa/qa_web_shop.py"""
import re, sys
from playwright.sync_api import sync_playwright, expect
import os
B=os.environ.get("WEB_URL","http://localhost:5174"); OUT=os.environ.get("QA_OUT","/tmp")
USER=os.environ.get("QA_USER","user@apetite.ru"); PASSWORD=os.environ.get("QA_PASSWORD","password123")  # демо-аккаунт из prisma/seed.ts
fails=[]
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ")+name+(" | "+str(extra) if extra and not cond else ""))
    if not cond: fails.append(name)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True)
    ctx=b.new_context(viewport={"width":1360,"height":860}); page=ctx.new_page()
    errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    # 1. карта
    page.goto(B+"/map"); page.wait_for_selector(".offer-row", timeout=15000)
    check("list rows rendered", page.locator(".offer-row").count()>=1, page.locator(".offer-row").count())
    page.wait_for_selector(".map-pin", timeout=15000)
    check("map pins rendered", page.locator(".map-pin").count()>=1)
    check("no footer on map", page.locator("footer.site-footer").count()==0)
    check("no page scroll on map", page.evaluate("document.documentElement.scrollHeight <= innerHeight+2"))
    # 2. клик по пину -> шторка
    page.locator(".map-pin").first.click(force=True); page.wait_for_selector(".offer-sheet")
    title=page.locator(".offer-sheet-title").inner_text()
    check("sheet opens on pin click", bool(title), title)
    check("sheet row highlighted", page.locator(".offer-row.is-selected").count()==1)
    page.screenshot(path=OUT+"/shop_map.png")
    # закрытие кликом по карте/крестику
    page.locator(".offer-sheet-close").click(); check("sheet closes", page.locator(".offer-sheet").count()==0)
    # выбор из списка
    page.locator(".offer-row").first.click(); page.wait_for_selector(".offer-sheet")
    # 3. гость -> вход
    buy=page.locator(".offer-sheet a.btn-primary"); check("guest sees 'Войти и купить'", "Войти" in buy.inner_text(), buy.inner_text())
    buy.click(); page.wait_for_url(re.compile("/login"))
    page.fill("#email",USER); page.fill("#password",PASSWORD); page.click("button[type=submit]")
    page.wait_for_url(re.compile("/checkout/"), timeout=15000)
    check("returned to checkout after login", "/checkout/" in page.url, page.url)
    check("header shows user menu", page.locator(".user-menu-btn").count()==1)
    # 4. оформление
    page.wait_for_selector(".checkout-submit")
    check("summary shows title", page.locator(".checkout-offer h2").inner_text()==title, page.locator(".checkout-offer h2").inner_text())
    page.get_by_role("radio", name=re.compile("СБП")).click()
    check("sbp selected", page.get_by_role("radio", name=re.compile("СБП")).get_attribute("aria-checked")=="true")
    page.screenshot(path=OUT+"/shop_checkout.png")
    # reload сохраняет сессию
    page.reload(); page.wait_for_selector(".checkout-submit", timeout=15000)
    check("session survives reload on protected page", "/checkout/" in page.url)
    check("method remembered", page.get_by_role("radio", name=re.compile("СБП")).get_attribute("aria-checked")=="true")
    reqs=[]; page.on("request", lambda r: reqs.append(r) if r.method=="POST" and r.url.endswith("/orders") else None)
    page.click(".checkout-submit")
    page.wait_for_selector(".cooking", timeout=5000); check("cooking screen", True)
    page.wait_for_selector(".celebration", timeout=8000); check("celebration screen", True)
    page.wait_for_url(re.compile(r"/orders/[0-9a-f-]{36}"), timeout=10000)
    check("exactly one POST /orders", len(reqs)==1, len(reqs))
    # 5. билет
    page.wait_for_selector(".pickup-code")
    code="".join(page.locator(".pickup-code span").all_inner_texts())
    check("pickup code 6 digits", re.fullmatch(r"\d{6}",code) is not None, code)
    check("qr image loaded", page.evaluate("document.querySelector('.pickup-qr img').naturalWidth>0"))
    # сидовые офферы имеют уже открытое окно самовывоза -> стадия "ready" (как в мобильном приложении)
    check("timeline ready (window open)", "Заберите до" in page.locator(".order-timeline-hint").inner_text() and page.locator(".order-stage.is-active .order-stage-label").inner_text()=="Можно забирать")
    check("done stages show checkmarks", page.locator(".order-stage.is-done").count()==2)
    check("badge honest (no 'принят')", "Оплата прошла" in page.locator(".ticket-badge").inner_text())
    check("no cancel UI", page.get_by_text(re.compile("Отменить заказ")).count()==0)
    page.wait_for_timeout(1600); page.screenshot(path=OUT+"/shop_ticket.png", full_page=True)
    # 6. список заказов
    page.goto(B+"/orders"); page.wait_for_selector(".order-card")
    check("order listed with title", title in page.locator(".order-card").first.inner_text(), page.locator(".order-card").first.inner_text())
    page.screenshot(path=OUT+"/shop_orders.png")
    page.locator(".order-card").first.click(); page.wait_for_selector(".pickup-code")
    check("order card opens ticket", "/orders/" in page.url)
    # 7. выход
    page.locator(".user-menu-btn").click(); page.get_by_role("menuitem", name="Выйти").click()
    page.wait_for_timeout(600)
    check("logout -> guest header", page.locator(".user-menu-btn").count()==0)
    page.goto(B+"/orders"); page.wait_for_url(re.compile("/login"), timeout=8000)
    check("guard redirects /orders to login", "/login" in page.url)
    check("tokens cleared", page.evaluate("localStorage.getItem('apetite.web.accessToken')")is None)
    print("console errors:", [e for e in errs if "favicon" not in e][:5])
    b.close()
print("FAILS:", fails); sys.exit(1 if fails else 0)
