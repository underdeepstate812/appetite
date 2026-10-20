import { mkdtempSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deleteUploadedOfferPhoto, detectImageKind, isAllowedOfferImageUrl, saveOfferPhoto } from "./offer-photo";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPVP8 ")]);

describe("detectImageKind", () => {
  it("recognises JPEG, PNG and WebP by their signatures", () => {
    expect(detectImageKind(JPG)).toBe("jpg");
    expect(detectImageKind(PNG)).toBe("png");
    expect(detectImageKind(WEBP)).toBe("webp");
  });

  it("rejects everything else, whatever the client claimed in the filename or Content-Type", () => {
    expect(detectImageKind(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectImageKind(Buffer.from("GIF89a......"))).toBeNull();
    expect(detectImageKind(Buffer.from("RIFF....WAVEfmt "))).toBeNull(); // RIFF, но не WebP
    expect(detectImageKind(Buffer.alloc(0))).toBeNull();
    expect(detectImageKind(Buffer.from([0xff, 0xd8]))).toBeNull(); // обрезанная сигнатура
  });
});

describe("isAllowedOfferImageUrl", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts what the service itself hands out", () => {
    expect(isAllowedOfferImageUrl(`/uploads/offers/${uuid}.jpg`)).toBe(true);
    expect(isAllowedOfferImageUrl(`/uploads/offers/${uuid}.webp`)).toBe(true);
    expect(isAllowedOfferImageUrl("/presets/burger.jpg")).toBe(true);
    expect(isAllowedOfferImageUrl("https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=75")).toBe(true);
  });

  it("rejects arbitrary hosts, path traversal, other upload folders and non-http schemes", () => {
    for (const bad of [
      "https://evil.example/pixel.png",
      "http://images.unsplash.com/photo-1",
      "https://images.unsplash.com.evil.example/photo-1",
      `/uploads/avatars/${uuid}.jpg`,
      `/uploads/offers/../avatars/${uuid}.jpg`,
      "/uploads/offers/not-a-uuid.jpg",
      "/presets/../../etc/passwd",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "",
    ]) {
      expect(isAllowedOfferImageUrl(bad)).toBe(false);
    }
  });
});

describe("saving and deleting uploaded photos", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "apetite-photo-"));
    process.env.UPLOADS_DIR = dir;
  });
  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it("stores the file under uploads/offers with a random name and removes only such files", async () => {
    const url = await saveOfferPhoto(PNG, "png");
    expect(url).toMatch(/^\/uploads\/offers\/[0-9a-f-]{36}\.png$/);
    const onDisk = join(dir, url.replace("/uploads/", ""));
    expect(existsSync(onDisk)).toBe(true);

    await deleteUploadedOfferPhoto(url);
    expect(existsSync(onDisk)).toBe(false);
  });

  it("never touches library presets, external images or foreign files", async () => {
    mkdirSync(join(dir, "avatars"));
    const avatar = join(dir, "avatars", "me.png");
    writeFileSync(avatar, "x");
    await deleteUploadedOfferPhoto("/uploads/avatars/me.png");
    await deleteUploadedOfferPhoto("/presets/burger.jpg");
    await deleteUploadedOfferPhoto("https://images.unsplash.com/photo-1");
    await deleteUploadedOfferPhoto(null);
    expect(existsSync(avatar)).toBe(true);
  });

  it("does not fail when the file is already gone", async () => {
    await expect(deleteUploadedOfferPhoto("/uploads/offers/123e4567-e89b-12d3-a456-426614174000.jpg")).resolves.toBeUndefined();
  });
});
