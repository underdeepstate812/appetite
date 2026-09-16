// Плейсхолдер backend-сервиса для Docker Compose (ШАГ 2).
// Настоящий NestJS API появится в ШАГ 4 и заменит этот файл.
const http = require("http");

const PORT = process.env.BACKEND_PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/api/v1/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "apetite-backend",
        note: "placeholder — настоящий NestJS API появится в ШАГ 4",
      })
    );
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(PORT, () => {
  console.log(`[apetite-backend placeholder] listening on :${PORT}`);
});
