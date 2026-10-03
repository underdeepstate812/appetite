import json, sys, urllib.request, urllib.error
BASE = "http://localhost:3000/api/v1"
results = []
def call(method, path, body=None, headers=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=10) as r: return r.status, r.read().decode(), dict(r.headers)
    except urllib.error.HTTPError as e: return e.code, e.read().decode(), dict(e.headers)
    except Exception as e: return -1, str(e), {}
def check(name, cond, detail=""):
    results.append(bool(cond)); print(("[PASS] " if cond else "[FAIL] ") + name + (f"  -- {detail}" if detail and not cond else ""))
try:
    with urllib.request.urlopen("http://localhost:3000/health", timeout=5) as r: hs = r.status
except Exception: hs = -1
check("GET /health (вне префикса) -> 200", hs == 200, str(hs))
s, b, _ = call("GET", "/offers/nearby?lat=59.9311&lng=30.3609&radiusKm=10")
offers = json.loads(b) if s == 200 else []
check("offers/nearby -> 200 массив", s == 200 and isinstance(offers, list), str(s))
check("цена со скидкой < исходной", all(o["discountedPrice"] < o["originalPrice"] for o in offers))
check("GET /offers/:id неизвестный uuid -> 404", call("GET", "/offers/00000000-0000-0000-0000-000000000000")[0] == 404)
check("GET /offers/:id мусор -> 4xx, не 500", 400 <= call("GET", "/offers/not-a-uuid")[0] < 500)
for q, name in [("lng=30", "нет lat"), ("lat=abc&lng=30", "lat не число"), ("lat=95&lng=30", "lat вне диапазона"), ("lat=59&lng=200", "lng вне диапазона"), ("lat=59&lng=30&radiusKm=-5", "отрицательный радиус"), ("lat=59&lng=30&radiusKm=99999999", "огромный радиус")]:
    s, b, _ = call("GET", "/offers/nearby?" + q); check(f"nearby: {name} -> 400", s == 400, f"{s}")
s, b, _ = call("POST", "/auth/login", {"identifier": "qa-nonexistent@example.invalid", "password": "wrong"}); check("login неизвестный пользователь -> 401", s == 401, f"{s}")
check("login пустое тело -> 400", call("POST", "/auth/login", {})[0] == 400)
check("register невалидный -> 400", call("POST", "/auth/register", {"email": "x", "password": "1"})[0] == 400)
check("otp/request невалидный телефон -> 400", call("POST", "/auth/otp/request", {"phone": "123"})[0] == 400)
check("business-applications пустая -> 400", call("POST", "/business-applications", {})[0] == 400)
Z = "00000000-0000-0000-0000-000000000000"
for m, p in [("GET", "/auth/me"), ("POST", "/auth/logout"), ("POST", "/auth/refresh"), ("GET", "/orders"), ("POST", "/orders"), ("GET", f"/orders/{Z}"), ("GET", f"/orders/{Z}/qrcode"), ("PATCH", f"/orders/{Z}/cancel"), ("PATCH", f"/orders/{Z}/complete"), ("PATCH", "/users/me"), ("PATCH", "/users/me/location"), ("POST", "/users/me/avatar"), ("GET", "/eco/me"), ("GET", "/notifications"), ("POST", "/notifications/push-token"), ("PATCH", "/notifications/x/read"), ("POST", "/notifications/run-digest"), ("GET", "/platform/stats"), ("GET", "/platform/businesses"), ("POST", "/scheduler/run-discounts"), ("POST", "/offers"), ("PATCH", f"/offers/{Z}"), ("DELETE", f"/offers/{Z}"), ("GET", "/businesses/mine"), ("POST", "/businesses"), ("DELETE", f"/businesses/{Z}")]:
    s, b, _ = call(m, p, {} if m in ("POST", "PATCH") else None); check(f"{m} {p} без токена -> 401", s == 401, f"{s}")
for m, p in [("GET", "/auth/me"), ("GET", "/orders"), ("POST", "/scheduler/run-discounts")]:
    s, b, _ = call(m, p, {} if m == "POST" else None, {"Authorization": "Bearer garbage.token.value"}); check(f"{m} {p} мусорный токен -> 401", s == 401, f"{s}")
check("webhook пустой -> 4xx", 400 <= call("POST", "/payments/webhook", {})[0] < 500)
check("webhook подделанная подпись -> отклонён", 400 <= call("POST", "/payments/webhook", {"type": "payment.succeeded", "orderId": "x"}, {"X-Signature": "forged"})[0] < 500)
s, b, _ = call("POST", "/auth/login", raw=b"{not json"); check("битый JSON -> 400 без stack trace", s == 400 and "node_modules" not in b, f"{s}")
s, b, _ = call("POST", "/auth/login", raw=b'{"a":"' + b"x" * 2_000_000 + b'"}'); check("тело 2 МБ -> 413/400, не 500", s in (400, 401, 413), f"{s}")
s, b, h = call("GET", "/health", headers={"Origin": "http://evil.example"}); acao = h.get("Access-Control-Allow-Origin"); check("CORS не отражает произвольный origin", acao != "http://evil.example", f"ACAO={acao}")
check("X-Powered-By скрыт", "X-Powered-By" not in h, str(h.get("X-Powered-By")))
check("X-Content-Type-Options: nosniff", any(k.lower() == "x-content-type-options" for k in h))
codes = [call("POST", "/auth/login", {"identifier": "qa-bruteforce@example.invalid", "password": f"wrong{i}"})[0] for i in range(20)]
check("rate limit на /auth/login (429 за 20 неверных попыток)", 429 in codes, f"codes={set(codes)}")
print(f"\nTOTAL: {sum(results)}/{len(results)} passed"); sys.exit(0 if all(results) else 1)
