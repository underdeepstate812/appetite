import os
import re, sys
from playwright.sync_api import sync_playwright

import struct, zlib

def decode_png(data):
    """Минимальный разбор PNG (8 бит, RGB/RGBA, без интерлейса) → (ширина, высота, байт на пиксель, строки)."""
    pos, idat = 8, b""
    while pos < len(data):
        n, typ = struct.unpack(">I4s", data[pos:pos + 8]); body = data[pos + 8:pos + 8 + n]; pos += 12 + n
        if typ == b"IHDR": w, h, depth, ctype, _, _, inter = struct.unpack(">IIBBBBB", body); assert depth == 8 and inter == 0 and ctype in (2, 6)
        elif typ == b"IDAT": idat += body
    bpp = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat); stride = w * bpp; rows = []; prev = bytearray(stride); i = 0
    for _ in range(h):
        f = raw[i]; line = bytearray(raw[i + 1:i + 1 + stride]); i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0; b = prev[x]; c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c); pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        rows.append(line); prev = line
    return w, h, bpp, rows

def pixel(png, x, y):
    w, h, bpp, rows = decode_png(png); return tuple(rows[y][x * bpp:x * bpp + 3])
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
        check(f"[{label}] на карточках ленты нет кнопки «в избранное» (лайк убран)", page.locator(".offer-tile-like").count() == 0 and page.get_by_role("button", name=re.compile("избранн")).count() == 0)
        play = page.locator(".ribbon-play"); pb = play.bounding_box()
        check(f"[{label}] кнопка паузы ленты не видна глазам (1×1 px, обрезана), но есть в дереве доступности", pb is not None and pb["width"] <= 2 and pb["height"] <= 2 and play.get_attribute("aria-label") in ("Остановить движение ленты", "Запустить движение ленты"))
        # Настоящий Tab (а не .focus() из скрипта): :focus-visible после кликов мышью у программного фокуса не включается
        page.locator(".ribbon-filter").last.focus(); page.keyboard.press("Tab"); page.wait_for_timeout(200)
        fb = play.bounding_box()
        check(f"[{label}] с клавиатуры (Tab/фокус) кнопка паузы проявляется — 44×44 px, фокус виден", fb and fb["width"] >= 43 and fb["height"] >= 43 and page.evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'"))
        page.evaluate("document.activeElement.blur()")
        # --- наведение на карточку: фото не должно вылезать за скруглённый угол и закрывать рамку ---
        tile = page.locator(".offer-tile:has(.offer-tile-photo-img)").first
        page.evaluate("document.querySelector('.ribbon-scroll').scrollLeft = 0"); page.wait_for_timeout(200)
        page.locator(".ribbon-play").evaluate("e => e.getAttribute('aria-label').startsWith('Остановить') && e.click()")  # лента едет — стоп, чтобы карточка не уезжала
        inside = "(() => { const t = document.querySelector('.offer-tile:has(.offer-tile-photo-img)'); const ph = t.querySelector('.offer-tile-photo').getBoundingClientRect(); const r = t.getBoundingClientRect(); return ph.right <= r.right - 1 + 0.01 && ph.left >= r.left + 1 - 0.01 && ph.top >= r.top + 1 - 0.01 })()"
        page.mouse.move(5, 5); page.wait_for_timeout(300)
        rest_ok = page.evaluate(inside)
        tb = tile.bounding_box(); page.mouse.move(tb["x"] + tb["width"] / 2, tb["y"] + tb["height"] / 2); page.wait_for_timeout(700)
        check(f"[{label}] карточка ленты: фото целиком внутри рамки — в покое и при наведении (не вылезает за угол)", rest_ok and page.evaluate(inside))
        tb = tile.bounding_box()
        if tb["y"] > 6 and tb["x"] + tb["width"] < vp["width"]:
            png = page.screenshot(clip={"x": tb["x"] + tb["width"] - 60, "y": tb["y"] - 4, "width": 48, "height": 12})
            bc = [int(v) for v in re.findall(r"\d+", tile.evaluate("e => getComputedStyle(e).borderTopColor"))[:3]]
            dist = min(sum(abs(c - d) for c, d in zip(pixel(png, 24, row), bc)) for row in (3, 4, 5))
            # у закрывающего рамку фото ни одна из строк на уровне верхней рамки не похожа на цвет рамки (серый снимок)
            check(f"[{label}] при наведении верхняя рамка карточки на месте и не закрыта фото (цвет рамки {bc}, расхождение {dist})", dist < 60, (bc, dist))
        page.mouse.move(5, 5)
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
