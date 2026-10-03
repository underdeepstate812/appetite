import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Controller, Get, UnauthorizedException } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configureApp } from "../src/app.setup";
import { AuthModule } from "../src/auth/auth.module";
import { AuthService } from "../src/auth/auth.service";
import { OffersModule } from "../src/offers/offers.module";
import { OffersService } from "../src/offers/offers.service";

@Controller()
class HealthController {
  @Get("health")
  health() {
    return { status: "ok" };
  }
}

/**
 * Реальные AuthModule/OffersModule и та же HTTP-конфигурация, что в main.ts (configureApp);
 * подменены только сервисы с доступом к Postgres/Redis — тесты не требуют внешних сервисов.
 */
describe("HTTP hardening (e2e)", () => {
  const API = "/api/v1";
  const nearbyQuery = "lat=59.9311&lng=30.3609";

  let uploadsDir: string;
  let app: NestExpressApplication;
  const authService = {
    login: jest.fn(),
    register: jest.fn(),
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
  };
  const offersService = { findNearby: jest.fn() };

  async function createApp(trustProxy?: string) {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_ACCESS_SECRET: "test-access-secret-000", JWT_REFRESH_SECRET: "test-refresh-secret-00" })],
        }),
        AuthModule,
        OffersModule,
      ],
      controllers: [HealthController],
    })
      .overrideProvider(AuthService)
      .useValue(authService)
      .overrideProvider(OffersService)
      .useValue(offersService)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, { apiPrefix: "api/v1", uploadsDir, trustProxy });
    await app.init();
    return app;
  }

  beforeAll(() => {
    uploadsDir = mkdtempSync(join(tmpdir(), "apetite-uploads-"));
    mkdirSync(join(uploadsDir, "avatars"));
    writeFileSync(join(uploadsDir, "avatars", "a.png"), "png-bytes");
  });

  afterAll(() => rmSync(uploadsDir, { recursive: true, force: true }));

  beforeEach(async () => {
    jest.resetAllMocks();
    offersService.findNearby.mockResolvedValue([]);
    authService.login.mockRejectedValue(new UnauthorizedException("Неверный логин или пароль"));
    authService.register.mockResolvedValue({ ok: true });
    authService.requestOtp.mockResolvedValue({ success: true });
    authService.verifyOtp.mockResolvedValue({ ok: true });
    await createApp();
  });

  afterEach(() => app.close());

  const login = (identifier: string, extra: Record<string, string> = {}) => {
    const req = request(app.getHttpServer()).post(`${API}/auth/login`);
    for (const [name, value] of Object.entries(extra)) req.set(name, value);
    return req.send({ identifier, password: "wrong" });
  };

  describe("security headers", () => {
    it("скрывает X-Powered-By и ставит helmet-заголовки", async () => {
      const res = await request(app.getHttpServer()).get("/health").expect(200);
      expect(res.headers["x-powered-by"]).toBeUndefined();
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBeDefined();
    });

    it("заголовки есть и на ответах об ошибке", async () => {
      const res = await login("someone@example.com").expect(401);
      expect(res.headers["x-powered-by"]).toBeUndefined();
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });
  });

  describe("/uploads и CORS", () => {
    it("раздаёт статику и разрешает встраивать её как <img> с других origin", async () => {
      const res = await request(app.getHttpServer()).get("/uploads/avatars/a.png").expect(200);
      expect(res.body.toString()).toBe("png-bytes");
      // helmet по умолчанию ставит same-origin — mobile web/admin на других портах не показали бы аватарки.
      expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("отвечает на CORS preflight web-клиентов", async () => {
      const res = await request(app.getHttpServer())
        .options(`${API}/auth/login`)
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "authorization,content-type")
        .expect(204);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.headers["access-control-allow-headers"]).toMatch(/authorization/i);
    });

    it("/health остаётся вне префикса API", async () => {
      await request(app.getHttpServer()).get(`${API}/health`).expect(404);
      await request(app.getHttpServer()).get("/health").expect(200);
    });
  });

  describe("размер тела запроса", () => {
    it("2 МБ JSON → 413, а не 500", async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ a: "x".repeat(2_000_000) }))
        .expect(413);
      expect(res.body).toMatchObject({ statusCode: 413, message: "Слишком большой размер запроса" });
      expect(authService.login).not.toHaveBeenCalled();
    });

    it("чуть выше лимита в 100 КБ → 413", async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ identifier: "x".repeat(101 * 1024), password: "p" }))
        .expect(413);
    });

    it("тело в пределах лимита обрабатывается как обычно", async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ identifier: "x".repeat(50 * 1024), password: "p" })
        .expect(401);
    });

    it("битый JSON → 400 без stack trace", async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .set("Content-Type", "application/json")
        .send("{not json")
        .expect(400);
      expect(JSON.stringify(res.body)).not.toContain("node_modules");
    });
  });

  describe("GET /offers/nearby: радиус", () => {
    it.each(["0.5", "10", "100"])("radiusKm=%s → 200", async (radiusKm) => {
      await request(app.getHttpServer()).get(`${API}/offers/nearby?${nearbyQuery}&radiusKm=${radiusKm}`).expect(200);
      expect(offersService.findNearby).toHaveBeenCalledWith(expect.objectContaining({ radiusKm: Number(radiusKm) }));
    });

    it.each(["100.5", "101", "99999999", "Infinity"])("radiusKm=%s → 400, сервис не вызывается", async (radiusKm) => {
      const res = await request(app.getHttpServer())
        .get(`${API}/offers/nearby?${nearbyQuery}&radiusKm=${radiusKm}`)
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain("radiusKm");
      expect(offersService.findNearby).not.toHaveBeenCalled();
    });

    it.each(["-5", "0", "abc"])("radiusKm=%s → 400", async (radiusKm) => {
      await request(app.getHttpServer()).get(`${API}/offers/nearby?${nearbyQuery}&radiusKm=${radiusKm}`).expect(400);
    });
  });

  describe("rate limiting", () => {
    it("POST /auth/login: 10 неверных попыток → 401, затем 429 с Retry-After", async () => {
      for (let i = 0; i < 10; i++) {
        await login("victim@example.com").expect(401);
      }
      const res = await login("victim@example.com").expect(429);
      expect(res.body).toMatchObject({ statusCode: 429, message: "Слишком много попыток. Попробуйте через минуту" });
      expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
      // Заблокированные попытки не доходят до сервиса (и до bcrypt).
      expect(authService.login).toHaveBeenCalledTimes(10);
    });

    it("блокировка не зависит от регистра идентификатора", async () => {
      for (let i = 0; i < 10; i++) await login(i % 2 ? "Victim@Example.com" : "victim@example.com").expect(401);
      await login(" VICTIM@example.com ").expect(429);
    });

    it("легитимный вход не задевается: успешные логины проходят, счётчик — на пару IP+идентификатор", async () => {
      authService.login.mockResolvedValue({ accessToken: "a", refreshToken: "r" });
      await login("user@example.com").expect(200);

      authService.login.mockRejectedValue(new UnauthorizedException());
      for (let i = 0; i < 9; i++) await login("attacked@example.com").expect(401);
      await login("attacked@example.com").expect(401);
      await login("attacked@example.com").expect(429);

      // Другой аккаунт с того же IP продолжает работать.
      authService.login.mockResolvedValue({ accessToken: "a", refreshToken: "r" });
      await login("user@example.com").expect(200);
    });

    it("перебор разных аккаунтов с одного IP упирается в лимит по IP (30/мин)", async () => {
      for (let i = 0; i < 30; i++) await login(`user${i}@example.com`).expect(401);
      const res = await login("user-31@example.com").expect(429);
      expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    });

    it("POST /auth/register и /auth/otp/request: 5 попыток на идентификатор в минуту", async () => {
      const register = () =>
        request(app.getHttpServer())
          .post(`${API}/auth/register`)
          .send({ email: "new@example.com", password: "Str0ng!Pass", name: "Новый" });
      for (let i = 0; i < 5; i++) await register().expect(201);
      await register().expect(429);

      const otp = () => request(app.getHttpServer()).post(`${API}/auth/otp/request`).send({ phone: "+79991234567" });
      for (let i = 0; i < 5; i++) await otp().expect(200);
      await otp().expect(429);
    });

    it("POST /auth/otp/verify тоже лимитирован", async () => {
      const verify = () =>
        request(app.getHttpServer()).post(`${API}/auth/otp/verify`).send({ phone: "+79991234567", code: "123456" });
      for (let i = 0; i < 10; i++) await verify().expect(200);
      await verify().expect(429);
    });

    it("остальное API не лимитируется", async () => {
      for (let i = 0; i < 60; i++) {
        await request(app.getHttpServer()).get(`${API}/offers/nearby?${nearbyQuery}&radiusKm=10`).expect(200);
      }
    });

    it("без TRUST_PROXY X-Forwarded-For игнорируется — подделкой заголовка лимит не обойти", async () => {
      for (let i = 0; i < 10; i++) await login("victim@example.com", { "X-Forwarded-For": `1.2.3.${i}` }).expect(401);
      await login("victim@example.com", { "X-Forwarded-For": "9.9.9.9" }).expect(429);
    });

    it("с TRUST_PROXY клиенты за прокси считаются по своим адресам", async () => {
      await app.close();
      await createApp("1");

      for (let i = 0; i < 10; i++) await login("victim@example.com", { "X-Forwarded-For": "1.1.1.1" }).expect(401);
      await login("victim@example.com", { "X-Forwarded-For": "1.1.1.1" }).expect(429);
      // Другой клиент за тем же прокси не наказывается за чужие попытки.
      await login("victim@example.com", { "X-Forwarded-For": "2.2.2.2" }).expect(401);
    });
  });
});
