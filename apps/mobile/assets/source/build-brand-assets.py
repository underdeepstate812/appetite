"""Бренд-ассеты приложения из ОДНОГО SVG-знака (тот же path, что в src/components/icons/AppetiteMark.tsx).

Запуск: python3 apps/mobile/assets/source/build-brand-assets.py  (нужен Playwright + Chromium; растеризует SVG в PNG).
Создаёт в apps/mobile/assets/: icon.png, splash-icon.png, android-icon-{foreground,background,monochrome}.png, favicon.png.
Раньше все они были шаблонными заглушками Expo (синий шеврон), а не нашим знаком.
"""
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

# Знак: жидкая капля-пин с «укусом» (вырез — evenodd). viewBox 48×48, занимает x 8…41, y 2…42.
MARK_PATH = "M24 3 C34 2 41 10 39 20 C38 27 33 33 26 40 C24.5 42 23 42 21 39 C14 31 8 25 9 17 C10 8 16 4 24 3 Z M39 13 A6 6 0 1 0 27 13 A6 6 0 1 0 39 13 Z"

def mark(size, x, y, fill, dot="#FFFFFF", dot_opacity=0.6, shadow=False):
    """Знак размером size (по высоте viewBox 48) с левым верхним углом в (x, y) холста; fill — url(#id) или цвет."""
    s = size / 48
    shade = f'<g transform="translate({x + size * 0.03},{y + size * 0.05}) scale({s})" opacity="0.28" filter="url(#blur)"><path fill-rule="evenodd" d="{MARK_PATH}" fill="#001a17"/></g>' if shadow else ""
    return f'''{shade}<g transform="translate({x},{y}) scale({s})"><path fill-rule="evenodd" d="{MARK_PATH}" fill="{fill}"/><circle cx="16" cy="14" r="2.5" fill="{dot}" opacity="{dot_opacity}"/></g>'''

DEFS = '''<defs>
  <linearGradient id="markGrad" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#8DF5E4"/><stop offset="0.55" stop-color="#2DD4BF"/><stop offset="1" stop-color="#119A8E"/></linearGradient>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E6A61"/><stop offset="1" stop-color="#052E2B"/></linearGradient>
  <radialGradient id="glow" cx="0.28" cy="0.2" r="0.85"><stop offset="0" stop-color="#2DD4BF" stop-opacity="0.38"/><stop offset="1" stop-color="#2DD4BF" stop-opacity="0"/></radialGradient>
  <radialGradient id="ember" cx="0.82" cy="0.9" r="0.55"><stop offset="0" stop-color="#FF8A3D" stop-opacity="0.30"/><stop offset="1" stop-color="#FF8A3D" stop-opacity="0"/></radialGradient>
  <filter id="blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.1"/></filter>
</defs>'''

def svg(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{DEFS}{body}</svg>'

def centered(canvas, height):
    """Левый верхний угол знака так, чтобы его оптический центр (24.5, 22 из 48) лёг в центр холста."""
    s = height / 48
    return canvas / 2 - 24.5 * s, canvas / 2 - 22 * s

def background(size):
    return f'<rect width="{size}" height="{size}" fill="url(#bg)"/><rect width="{size}" height="{size}" fill="url(#glow)"/><rect width="{size}" height="{size}" fill="url(#ember)"/>'

ASSETS = {
    # iOS/общий значок: полный квадрат (ОС скругляет сама)
    "icon.png": (1024, svg(1024, 1024, background(1024) + mark(640, *centered(1024, 640), "url(#markGrad)", shadow=True)), False),
    # Заставка: знак на прозрачном (фон задаёт конфиг expo-splash-screen, тот же #052E2B)
    "splash-icon.png": (1024, svg(1024, 1024, mark(760, *centered(1024, 760), "url(#markGrad)")), True),
    # Android adaptive: знак в «безопасной зоне» (центральные 66%), фон отдельным слоем
    "android-icon-foreground.png": (1024, svg(1024, 1024, mark(540, *centered(1024, 540), "url(#markGrad)", shadow=True)), True),
    "android-icon-background.png": (1024, svg(1024, 1024, background(1024)), False),
    # Тематическая (Android 13+): однотонный силуэт, ОС красит сама
    "android-icon-monochrome.png": (1024, svg(1024, 1024, mark(540, *centered(1024, 540), "#FFFFFF", dot="#000000", dot_opacity=0)), True),
    # Вкладка браузера: скруглённый квадрат, знак крупнее
    "favicon.png": (48, svg(48, 48, '<rect width="48" height="48" rx="11" fill="url(#bg)"/>' + mark(34, *centered(48, 34), "url(#markGrad)")), True),
}

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, (size, markup, transparent) in ASSETS.items():
        page = browser.new_page(viewport={"width": size, "height": size}, device_scale_factor=1)
        page.set_content(f'<html><body style="margin:0;background:transparent">{markup}</body></html>')
        page.screenshot(path=os.path.join(OUT, name), omit_background=transparent, clip={"x": 0, "y": 0, "width": size, "height": size})
        page.close()
        print("ok", name)
    browser.close()
