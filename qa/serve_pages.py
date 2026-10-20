"""Локальный двойник GitHub Pages для проверки демо-сборки (scripts/build-demo.sh → site/).
Отдаёт site/ по адресу http://localhost:PORT/appetite/…, как Pages: каталог → index.html, нет файла → /appetite/404.html со статусом 404.
Запуск: python3 qa/serve_pages.py [PORT] [BASE]"""
import http.server, mimetypes, os, socketserver, sys
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
BASE = (sys.argv[2] if len(sys.argv) > 2 else "/appetite").rstrip("/")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site")

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, status, path):
        with open(path, "rb") as f: data = f.read()
        self.send_response(status)
        self.send_header("Content-Type", mimetypes.guess_type(path)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        path = self.path.split("?")[0].split("#")[0]
        if not path.startswith(BASE + "/") and path != BASE:
            return self._notfound()
        rel = path[len(BASE):].lstrip("/")
        full = os.path.normpath(os.path.join(ROOT, rel))
        if not full.startswith(os.path.normpath(ROOT)): return self._notfound()
        if os.path.isdir(full):
            if not path.endswith("/"):
                self.send_response(301); self.send_header("Location", path + "/"); self.end_headers(); return
            full = os.path.join(full, "index.html")
        if os.path.isfile(full): return self._send(200, full)
        self._notfound()
    def _notfound(self):
        page = os.path.join(ROOT, "404.html")
        if os.path.isfile(page): return self._send(404, page)
        self.send_response(404); self.end_headers()

socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as srv:
    print(f"Pages-двойник: http://localhost:{PORT}{BASE}/"); srv.serve_forever()
