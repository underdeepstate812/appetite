const REDIRECT_KEY = "apetite.demo.redirect";

/**
 * GitHub Pages не знает про клиентские маршруты: /appetite/web/profile даёт 404. Страница 404.html запоминает путь и отправляет
 * в корень приложения, а здесь, до старта роутера, мы возвращаем адресную строку на место — обновление страницы не теряет место.
 */
export function restoreRedirectedPath() {
  try {
    const saved = sessionStorage.getItem(REDIRECT_KEY);
    if (!saved) return;
    sessionStorage.removeItem(REDIRECT_KEY);
    history.replaceState(null, "", saved);
  } catch {
    /* sessionStorage недоступен — откроется корень приложения */
  }
}

/** Плашка «ДЕМО» внизу слева: что это, под кем войти, «Сбросить» возвращает исходные данные. Чистый DOM — работает в любом из трёх приложений. */
export function mountBanner(app: string, lines: string[], onReset: () => void) {
  if (typeof document === "undefined") return;
  const mount = () => {
    if (document.getElementById("apetite-demo-banner")) return;
    const box = document.createElement("div");
    box.id = "apetite-demo-banner";
    box.setAttribute("role", "note");
    // Свёрнутая плашка — крошечная метка «ДЕМО», чтобы не закрывать кнопки приложения внизу экрана; по нажатию раскрывается вверх.
    box.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:2147483000;max-width:min(320px,calc(100vw - 16px));font:500 12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;color:#fffdf9;background:rgba(18,16,13,.82);border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:3px 9px;box-shadow:0 6px 20px rgba(0,0,0,.3);backdrop-filter:blur(8px)";
    const head = document.createElement("button");
    head.type = "button";
    head.style.cssText = "all:unset;cursor:pointer;display:flex;align-items:center;gap:7px;font-weight:700;letter-spacing:.06em;min-height:24px;width:100%";
    head.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:#ff8a3d;flex:none"></span><span data-title>ДЕМО</span><span style="margin-left:auto;opacity:.7" data-chev>▴</span>';
    const body = document.createElement("div");
    body.style.cssText = "margin-top:6px;display:none";
    body.innerHTML = lines.map((line) => `<div style="margin:2px 0;opacity:.9">${line}</div>`).join("");
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Сбросить демо-данные";
    reset.style.cssText = "all:unset;cursor:pointer;margin-top:8px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.12);font-weight:700;display:inline-block";
    reset.onclick = () => {
      onReset();
      location.reload();
    };
    body.appendChild(reset);
    head.setAttribute("aria-expanded", "false");
    // Плашку можно перетащить: на телефоне она иначе закрывала бы значок вкладки или кнопку приложения под собой.
    let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
    head.addEventListener("pointerdown", (event) => {
      const rect = box.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
      head.setPointerCapture(event.pointerId);
    });
    head.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      const left = Math.min(Math.max(0, drag.left + dx), window.innerWidth - box.offsetWidth);
      const top = Math.min(Math.max(0, drag.top + dy), window.innerHeight - box.offsetHeight);
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.bottom = "auto";
    });
    let justDragged = false;
    head.addEventListener("pointerup", () => {
      justDragged = !!drag?.moved;
      drag = null;
    });
    head.onclick = () => {
      if (justDragged) {
        justDragged = false;
        return;
      }
      const open = body.style.display === "none";
      body.style.display = open ? "block" : "none";
      head.setAttribute("aria-expanded", String(open));
      (head.querySelector("[data-chev]") as HTMLElement).textContent = open ? "▾" : "▴";
      (head.querySelector("[data-title]") as HTMLElement).textContent = open ? `ДЕМО · ${app}` : "ДЕМО";
      box.style.padding = open ? "8px 12px" : "3px 9px";
    };
    box.append(head, body);
    document.body.appendChild(box);
  };
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
}
