import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CanActivate, ExecutionContext } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";
import { configureApp } from "../src/app.setup";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { OffersModule } from "../src/offers/offers.module";
import { OffersService } from "../src/offers/offers.service";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";

const API = "/api/v1";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const UUID_URL = "/uploads/offers/123e4567-e89b-12d3-a456-426614174000.jpg";

/** Гард авторизации подменён: роль берётся из заголовка x-test-role — проверяем именно права, а не JWT. */
class FakeJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const role = req.headers["x-test-role"] as Role | undefined;
    if (!role) return false; // → 403 от Nest; для проверки "без токена" этого достаточно
    req.user = { userId: "u-1", email: "b@b.ru", role };
    return true;
  }
}

describe("Offer photos (e2e)", () => {
  let uploadsDir: string;
  let app: NestExpressApplication;
  const offerRow = { id: "o-1", imageUrl: UUID_URL, business: { ownerUserId: "u-1" } };
  const prisma = {
    offer: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    business: { findUnique: jest.fn() },
  };

  beforeAll(async () => {
    uploadsDir = mkdtempSync(join(tmpdir(), "apetite-e2e-uploads-"));
    process.env.UPLOADS_DIR = uploadsDir;
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule, OffersModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeJwtGuard)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, { apiPrefix: "api/v1", uploadsDir, presetsDir: join(process.cwd(), "assets", "offer-presets") });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.UPLOADS_DIR;
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.offer.findUnique.mockResolvedValue(offerRow);
    prisma.offer.update.mockResolvedValue({ id: "o-1" });
    prisma.offer.delete.mockResolvedValue({});
    prisma.offer.count.mockResolvedValue(0);
  });

  const upload = (role: string | undefined, body: Buffer, filename = "dish.png", type = "image/png") => {
    const req = request(app.getHttpServer()).post(`${API}/offers/photo`);
    if (role) req.set("x-test-role", role);
    return req.attach("photo", body, { filename, contentType: type });
  };

  describe("POST /offers/photo", () => {
    it("stores a real image for a business and returns a usable URL that is then served", async () => {
      const res = await upload(Role.BUSINESS, PNG);
      expect(res.status).toBe(201);
      expect(res.body.imageUrl).toMatch(/^\/uploads\/offers\/[0-9a-f-]{36}\.png$/);
      expect(existsSync(join(uploadsDir, res.body.imageUrl.replace("/uploads/", "")))).toBe(true);
      await request(app.getHttpServer()).get(res.body.imageUrl).expect(200);
    });

    it("refuses a non-image even when it claims image/png and a .png name (spoofed)", async () => {
      const res = await upload(Role.BUSINESS, Buffer.from("<script>alert(1)</script>"));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/JPEG, PNG или WebP/);
    });

    it("refuses files over 5 MB with a readable Russian message", async () => {
      const res = await upload(Role.BUSINESS, Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]));
      expect(res.status).toBe(413);
      expect(res.body.message).toMatch(/слишком большой/);
    });

    it("is closed to customers and to anonymous callers", async () => {
      expect((await upload(Role.USER, PNG)).status).toBe(403);
      expect((await upload(undefined, PNG)).status).toBe(403);
    });

    it("answers 400 when no file is attached", async () => {
      const res = await request(app.getHttpServer()).post(`${API}/offers/photo`).set("x-test-role", Role.BUSINESS);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /offers/photo-presets", () => {
    it("lists the default library (and is not mistaken for an offer id)", async () => {
      const res = await request(app.getHttpServer()).get(`${API}/offers/photo-presets`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(10);
      expect(res.body[0]).toEqual(expect.objectContaining({ id: expect.any(String), label: expect.any(String), url: expect.any(String), category: expect.any(String) }));
    });

    it("every local preset points to a file that is actually served", async () => {
      const res = await request(app.getHttpServer()).get(`${API}/offers/photo-presets`);
      const local = res.body.filter((p: { url: string }) => p.url.startsWith("/presets/"));
      expect(local.length).toBeGreaterThan(5);
      for (const preset of local) {
        const file = await request(app.getHttpServer()).get(preset.url);
        expect(file.status).toBe(200);
        expect(file.headers["content-type"]).toMatch(/image\/jpeg/);
      }
    });
  });

  describe("imageUrl validation on edit", () => {
    const patch = (body: object) =>
      request(app.getHttpServer()).patch(`${API}/offers/123e4567-e89b-12d3-a456-426614174111`).set("x-test-role", Role.BUSINESS).send(body);

    it("rejects foreign hosts, traversal and other schemes", async () => {
      for (const imageUrl of ["https://evil.example/p.png", "javascript:alert(1)", "/uploads/offers/../avatars/x.jpg", "/etc/passwd"]) {
        const res = await patch({ imageUrl });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.message)).toMatch(/Недопустимый адрес фото/);
      }
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it("accepts a library preset", async () => {
      expect((await patch({ imageUrl: "/presets/burger.jpg" })).status).toBe(200);
    });

    it("removes the previously uploaded file when the photo is replaced or cleared", async () => {
      const oldFile = join(uploadsDir, "offers", "123e4567-e89b-12d3-a456-426614174000.jpg");
      mkdirSync(join(uploadsDir, "offers"), { recursive: true });
      writeFileSync(oldFile, "old");
      expect((await patch({ imageUrl: null })).status).toBe(200); // null снимает фото
      expect(prisma.offer.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageUrl: null }) }));
      expect(existsSync(oldFile)).toBe(false);
    });

    it("keeps the old file while another offer still uses it", async () => {
      const oldFile = join(uploadsDir, "offers", "123e4567-e89b-12d3-a456-426614174000.jpg");
      mkdirSync(join(uploadsDir, "offers"), { recursive: true });
      writeFileSync(oldFile, "old");
      prisma.offer.count.mockResolvedValue(1);
      await patch({ imageUrl: "/presets/pizza-pepperoni.jpg" });
      expect(existsSync(oldFile)).toBe(true);
    });

    it("leaves the photo alone when the edit does not mention it", async () => {
      const oldFile = join(uploadsDir, "offers", "123e4567-e89b-12d3-a456-426614174000.jpg");
      mkdirSync(join(uploadsDir, "offers"), { recursive: true });
      writeFileSync(oldFile, "old");
      await patch({ title: "Новое название" });
      expect(existsSync(oldFile)).toBe(true);
    });
  });

  it("OffersService is the real one (not a stub) in this suite", () => {
    expect(app.get(OffersService).photoPresets().length).toBeGreaterThan(0);
  });
});
