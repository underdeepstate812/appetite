import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Корень загружаемых файлов — тот же, что раздаётся по /uploads (main.ts). Читается лениво, чтобы тесты могли
 * подменить каталог через UPLOADS_DIR и не писать в настоящий uploads/.
 */
export const uploadsRoot = (): string => process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");
const offerPhotosDir = (): string => join(uploadsRoot(), "offers");

export const MAX_OFFER_PHOTO_BYTES = 5 * 1024 * 1024;

export type ImageKind = "jpg" | "png" | "webp";

/**
 * Определяет формат по сигнатуре файла (магическим байтам), а не по заявленному клиентом Content-Type и
 * расширению: оба подделываются одной строкой, и в /uploads попадал бы произвольный файл (HTML, скрипт).
 */
export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

/** Файл, загруженный через POST /offers/photo: /uploads/offers/<uuid>.<ext>. */
const UPLOADED_PHOTO_URL = /^\/uploads\/offers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
/** Фото из библиотеки по умолчанию (apps/backend/assets/offer-presets). */
const PRESET_PHOTO_URL = /^\/presets\/[a-z0-9-]+\.jpg$/;
/** Бесплатные фото Unsplash — для библиотеки и сид-данных. Произвольные внешние адреса не принимаем (трекинг, хотлинк). */
const UNSPLASH_PHOTO_URL = /^https:\/\/images\.unsplash\.com\/photo-[A-Za-z0-9_-]+(\?[A-Za-z0-9=&._-]*)?$/;

export function isUploadedOfferPhotoUrl(url: string): boolean {
  return UPLOADED_PHOTO_URL.test(url);
}

export function isAllowedOfferImageUrl(url: string): boolean {
  return UPLOADED_PHOTO_URL.test(url) || PRESET_PHOTO_URL.test(url) || UNSPLASH_PHOTO_URL.test(url);
}

/** Сохраняет проверенное изображение и возвращает публичный относительный URL. */
export async function saveOfferPhoto(buffer: Buffer, kind: ImageKind): Promise<string> {
  await mkdir(offerPhotosDir(), { recursive: true });
  const filename = `${randomUUID()}.${kind}`;
  await writeFile(join(offerPhotosDir(), filename), buffer);
  return `/uploads/offers/${filename}`;
}

/** Удаляет загруженный файл (best-effort). Фото из библиотеки и внешние адреса не трогаем — они общие. */
export async function deleteUploadedOfferPhoto(url: string | null | undefined): Promise<void> {
  if (!url || !isUploadedOfferPhotoUrl(url)) return;
  try {
    await unlink(join(uploadsRoot(), url.replace(/^\/uploads\//, "")));
  } catch {
    // файла уже нет — не повод падать
  }
}
