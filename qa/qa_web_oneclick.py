"""Заказ в 1 клик с ленты на главной — на РЕАЛЬНОМ backend (нужна витрина: pnpm --filter @apetite/backend prisma:seed:showcase).
Веб должен ходить в API на localhost (см. докстринг qa_web_shop.py); WEB_URL=... python3 qa/qa_web_oneclick.py"""
import re, sys
from playwright.sync_api import sync_playwright
import os
B=os.environ.get("WEB_URL","http://localhost:5174"); OUT=os.environ.get("QA_OUT","/tmp"); fails=[]
def check(n,c,x=""):
    print(("PASS " if c else "FAIL ")+n+(" | "+str(x) if x and not c else "")); 
    if not c: fails.append(n)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True); ctx=b.new_context(viewport={"width":1360,"height":900}); page=ctx.new_page()
    errs=[]; page.on("pageerror", lambda e: errs.append(str(e))); page.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    posts=[]; page.on("request", lambda r: posts.append(r.url) if r.method=="POST" and r.url.endswith("/orders") else None)
    page.goto(B+"/"); page.wait_for_load_state("networkidle")
    page.locator(".ribbon-viewport").scroll_into_view_if_needed(); page.wait_for_timeout(1500)
    n_tiles=page.locator(".offer-tile").count(); check("live tiles rendered (>=19 x2 loop)", n_tiles>=38, n_tiles)
    check("tiles use backend photos", page.evaluate("[...document.querySelectorAll('.offer-tile-photo-img')].some(i=>i.src.includes('/uploads/offers/'))"))
    # лента движется
    page.mouse.move(5,5); a=page.evaluate("document.querySelector('.ribbon-scroll').scrollLeft"); page.wait_for_timeout(2000); c=page.evaluate("document.querySelector('.ribbon-scroll').scrollLeft")
    check("ribbon auto-scrolls", c>a+10, (a,c))
    # пауза
    # кнопка паузы скрыта глазам и доступна с клавиатуры: фокус + Enter
    page.get_by_role("button", name="Остановить движение ленты").focus(); page.keyboard.press("Enter"); page.mouse.move(5,5); a=page.evaluate("document.querySelector('.ribbon-scroll').scrollLeft"); page.wait_for_timeout(800); c=page.evaluate("document.querySelector('.ribbon-scroll').scrollLeft")
    check("pause button (keyboard) stops ribbon", abs(c-a)<2, (a,c)); page.get_by_role("button", name="Запустить движение ленты").focus(); page.keyboard.press("Enter")
    # гость
    check("guest sees 'Войти и заказать'", page.get_by_role("link", name="Войти и заказать").count()>0)
    page.screenshot(path=OUT+"/oc_guest.png")
    page.get_by_role("link", name="Войти и заказать").first.click(); page.wait_for_url(re.compile("/login"))
    page.fill("#email","user@apetite.ru"); page.fill("#password","password123"); page.click("button[type=submit]")
    page.wait_for_url(B+"/", timeout=15000); check("login returns to landing", page.url.rstrip("/")==B)
    page.locator(".ribbon-viewport").scroll_into_view_if_needed(); page.wait_for_timeout(1200)
    btn=page.locator(".offer-tile:not([aria-hidden]) .offer-tile-oneclick").first
    label=btn.get_attribute("aria-label"); print("first order button:", label)
    btn.hover(); page.wait_for_timeout(300)
    btn.click()
    page.wait_for_selector("[role=dialog]"); check("consent dialog shown", True)
    check("no order before consent", len(posts)==0)
    page.screenshot(path=OUT+"/oc_dialog.png")
    page.keyboard.press("Escape"); page.wait_for_timeout(300); check("Esc closes dialog w/o order", page.locator("[role=dialog]").count()==0 and len(posts)==0)
    btn.click(); page.wait_for_selector("[role=dialog]")
    page.get_by_role("radio", name=re.compile("СБП")).click()
    page.locator("[role=dialog] .btn-primary").click()
    done=page.locator(".offer-tile:not([aria-hidden]) .offer-tile-oneclick.is-done").first
    done.wait_for(timeout=8000); check("tile shows 'Заказано'", True)
    check("exactly one POST /orders", len(posts)==1, len(posts))
    page.wait_for_timeout(500); page.screenshot(path=OUT+"/oc_done.png")
    href=done.get_attribute("href"); check("ticket link", bool(re.match(r"/orders/[0-9a-f-]{36}",href or "")), href)
    # второй заказ — уже без диалога, одним кликом
    btn2=page.locator(".offer-tile:not([aria-hidden]) button.offer-tile-oneclick").first
    btn2.click(); page.wait_for_timeout(1500)
    check("second order: no dialog", page.locator("[role=dialog]").count()==0)
    check("second order created (2 POSTs total)", len(posts)==2, len(posts))
    # билет открывается
    done.click(); page.wait_for_url(re.compile("/orders/"), timeout=8000); page.wait_for_selector(".pickup-code")
    check("ticket opens with code", True)
    # method persisted from dialog
    check("sbp remembered", page.evaluate("localStorage.getItem('apetite.web.paymentMethod')")=="sbp")
    # выход снимает согласие
    page.locator(".user-menu-btn").click(); page.get_by_role("menuitem", name="Выйти").click(); page.wait_for_timeout(600)
    check("logout revokes consent", page.evaluate("localStorage.getItem('apetite.web.oneClickConsent')") is None)
    print("console errors:", [e for e in errs if "favicon" not in e][:5])
    b.close()
print("FAILS:",fails); sys.exit(1 if fails else 0)
