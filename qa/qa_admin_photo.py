"""Админка: фото оффера — из библиотеки, своё (загрузка), замена, снятие; ошибки; видно ли покупателю. На РЕАЛЬНОМ backend + seed.
Создаёт и удаляет собственный тестовый оффер ("QA фото-тест …"). Нужны запущенные backend, admin и web (карта покупателя)."""
import json, os, re, struct, sys, tempfile, urllib.request, zlib
from playwright.sync_api import sync_playwright

T = lambda name: os.path.join(tempfile.gettempdir(), "qa_" + name)  # временные файлы сценария
HERE=os.path.dirname(os.path.abspath(__file__))
API=os.environ.get("API_URL","http://localhost:3000/api/v1"); ADMIN=os.environ.get("ADMIN_URL","http://localhost:5173"); WEB=os.environ.get("WEB_URL","http://localhost:5174")
UPLOADS=os.environ.get("UPLOADS_DIR", os.path.join(HERE,"..","apps","backend","uploads","offers"))  # где backend хранит загруженные фото
fails=[]
def check(n,c,x=""):
    print(("PASS " if c else "FAIL ")+n+(" | "+str(x) if x and not c else ""))
    if not c: fails.append(n)
def api(method, path, body=None, token=None):
    req=urllib.request.Request(API+path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+token} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=15) as r: t=r.read().decode(); return r.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read().decode() or "null")
def png(path, w=96, h=72, color=(214,67,46)):
    raw=b"".join(b"\x00"+bytes(color)*w for _ in range(h))
    def chunk(t,d): c=struct.pack(">I",len(d))+t+d; return c+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    open(path,"wb").write(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",w,h,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(raw))+chunk(b"IEND",b""))
png(T("dish.png")); open(T("fake.png"),"w").write("<html>not an image</html>")
open(T("big.png"),"wb").write(b"\x89PNG\r\n\x1a\n"+b"0"*(5*1024*1024+10))

st,login=api("POST","/auth/login",{"identifier":os.environ.get("QA_BUSINESS","cafe.pushkin@apetite.ru"),"password":os.environ.get("QA_PASSWORD","password123")}); assert st in (200,201), login
tok=login["accessToken"]
created=[]
try:
  with sync_playwright() as p:
      b=p.chromium.launch(headless=True); ctx=b.new_context(viewport={"width":1360,"height":900}); page=ctx.new_page(); errs=[]
      page.on("pageerror", lambda e: errs.append(str(e)))
      page.goto(ADMIN+"/login"); page.evaluate("([a,r]) => { localStorage.setItem('apetite.admin.accessToken', a); localStorage.setItem('apetite.admin.refreshToken', r); }", [login["accessToken"], login["refreshToken"]])
      page.goto(ADMIN+"/offers"); page.wait_for_selector("text=Быстрое создание", timeout=20000)
      # ---------- быстрое создание + фото из библиотеки ----------
      title="QA фото-тест "+os.urandom(2).hex()
      page.fill("#quick-title", title); page.fill("#quick-price","500"); page.fill("#quick-weight","0.4")
      # состав и аллергены обязательны для еды (покупатель видит их до оплаты)
      page.fill("#quick-ingredients","Говядина, булка, овощи"); page.locator("#quick-allergens").click(); page.get_by_role("checkbox", name="Аллергенов нет", exact=True).check(); page.keyboard.press("Escape")
      page.get_by_role("button", name="Из библиотеки").first.click(); page.wait_for_selector(".photo-library-item")
      check("library shows presets", page.locator(".photo-library-item").count()>=10, page.locator(".photo-library-item").count())
      check("food presets first for FOOD", "Бургер" in page.locator(".photo-library-item").first.inner_text() or "Пицца" in page.locator(".photo-library-item").first.inner_text())
      page.locator(".photo-library-item", has_text="Бургер").click()
      check("preview shows chosen preset", page.locator(".photo-field-preview img").count()==1)
      check("library closes after pick", page.locator(".photo-library").count()==0)
      page.screenshot(path=T("admin_quick.png"))
      page.get_by_role("button", name="Опубликовать").click(); page.wait_for_timeout(1500)
      st,lst=api("GET","/offers?pageSize=100&status=ACTIVE")
      mine=[o for o in lst["items"] if o["title"]==title]; check("offer created with preset photo", len(mine)==1 and mine[0]["imageUrl"]=="/presets/burger.jpg", mine and mine[0].get("imageUrl"))
      if mine: created.append(mine[0]["id"])
      page.wait_for_selector(f"tr:has-text('{title}') img.offer-thumb"); check("table thumbnail visible", True)
      check("thumbnail actually loads", page.evaluate("(t)=>{const i=[...document.querySelectorAll('tr')].find(r=>r.textContent.includes(t)).querySelector('img.offer-thumb'); return i.complete && i.naturalWidth>0}", title))
      # ---------- редактирование + своё фото ----------
      page.locator(f"tr:has-text('{title}')").get_by_role("button", name="Изменить").click(); page.wait_for_selector("[role=dialog] .photo-field")
      page.set_input_files("[role=dialog] input[type=file]", T("fake.png")); page.wait_for_selector(".form-error")
      check("spoofed non-image rejected with message", "JPEG, PNG или WebP" in page.locator(".photo-field .form-error").inner_text(), page.locator(".photo-field .form-error").inner_text())
      page.set_input_files("[role=dialog] input[type=file]", T("big.png")); page.wait_for_timeout(300)
      check("oversized file rejected on the client", "5 МБ" in page.locator(".photo-field .form-error").inner_text())
      page.set_input_files("[role=dialog] input[type=file]", T("dish.png")); page.wait_for_function("document.querySelector('.photo-field-preview img') && document.querySelector('.photo-field-preview img').src.includes('/uploads/offers/')", timeout=10000)
      check("custom upload previewed from backend", True); check("error cleared after success", page.locator(".photo-field .form-error").count()==0)
      page.screenshot(path=T("admin_edit.png"))
      page.locator("[role=dialog]").get_by_role("button", name="Сохранить").click(); page.wait_for_selector("[role=dialog]", state="detached")
      st,o=api("GET","/offers/"+created[0]); new_url=o["imageUrl"]
      check("edit saved custom photo URL", re.fullmatch(r"/uploads/offers/[0-9a-f-]{36}\.png", new_url or "") is not None, new_url)
      check("uploaded file exists on disk", os.path.exists(os.path.join(UPLOADS, os.path.basename(new_url))))
      with urllib.request.urlopen("http://localhost:3000"+new_url) as r: check("uploaded photo is served as an image", r.status==200 and "image" in r.headers.get("content-type",""))
      # ---------- публичная витрина показывает своё фото ----------
      # Витрина (/home): в ленте сверху — только самые горячие, поэтому свежий оффер ищем по метке на карте и открываем с клавиатуры.
      pg=ctx.new_page(); pg.goto(WEB+"/home"); pg.wait_for_selector(".leaflet-marker-icon", timeout=15000); pg.wait_for_timeout(1500)
      pin=pg.locator(f'.leaflet-marker-icon[title^="{title}"]'); check("customer map has the offer pin", pin.count()==1)
      pin.first.focus(); pg.keyboard.press("Enter"); pg.wait_for_selector(".offer-sheet"); pg.wait_for_timeout(800)
      check("customer sees the uploaded photo (not a broken image)", pg.evaluate("()=>{const i=document.querySelector('.offer-sheet img'); return !!i && i.src.includes('/uploads/offers/') && i.complete && i.naturalWidth>0}")); pg.close()
      # ---------- замена на библиотечное: старый файл удаляется ----------
      page.reload(); page.wait_for_selector(f"tr:has-text('{title}')")
      page.locator(f"tr:has-text('{title}')").get_by_role("button", name="Изменить").click(); page.wait_for_selector(".photo-field")
      page.locator("[role=dialog]").get_by_role("button", name="Из библиотеки").click(); page.locator(".photo-library-item", has_text="Пицца").click()
      page.locator("[role=dialog]").get_by_role("button", name="Сохранить").click(); page.wait_for_timeout(1500)
      st,o=api("GET","/offers/"+created[0]); check("switched to preset", o["imageUrl"]=="/presets/pizza-pepperoni.jpg", o["imageUrl"])
      check("replaced upload deleted from disk", not os.path.exists(os.path.join(UPLOADS, os.path.basename(new_url))))
      # ---------- снять фото ----------
      page.reload(); page.wait_for_selector(f"tr:has-text('{title}')")
      page.locator(f"tr:has-text('{title}')").get_by_role("button", name="Изменить").click(); page.wait_for_selector(".photo-field")
      page.locator("[role=dialog]").get_by_role("button", name="Убрать").click(); page.locator("[role=dialog]").get_by_role("button", name="Сохранить").click(); page.wait_for_timeout(1500)
      st,o=api("GET","/offers/"+created[0]); check("photo removed (null)", o["imageUrl"] is None, o["imageUrl"])
      # правка без фото не трогает фото
      st,o=api("PATCH","/offers/"+created[0],{"imageUrl":"/presets/sushi-philadelphia.jpg"},tok); check("api accepts preset", st==200, (st,o))
      page.reload(); page.wait_for_selector(f"tr:has-text('{title}')"); page.locator(f"tr:has-text('{title}')").get_by_role("button", name="Изменить").click(); page.wait_for_selector(".photo-field")
      page.locator("[role=dialog] #title").fill(title+" v2"); page.locator("[role=dialog]").get_by_role("button", name="Сохранить").click(); page.wait_for_timeout(1500)
      st,o=api("GET","/offers/"+created[0]); check("editing other fields keeps the photo", o["imageUrl"]=="/presets/sushi-philadelphia.jpg", o["imageUrl"])
      # серверная защита
      st,o=api("PATCH","/offers/"+created[0],{"imageUrl":"https://evil.example/p.png"},tok); check("server rejects foreign image URL", st==400, (st,o))
      print("console/page errors:", errs[:3]); b.close()

finally:
  for oid in created: print("cleanup", oid, api("PATCH","/offers/"+oid,{"status":"ARCHIVED"},tok)[0], api("DELETE","/offers/"+oid,None,tok)[0])
print("FAILS:",fails); sys.exit(1 if fails else 0)
