import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { BusinessStatus, OfferCategory, OfferStatus, OrderStatus, PrismaClient, Role } from "@prisma/client";
import { computeDiscountPercent, PLATFORM_COMMISSION_PERCENT } from "@apetite/shared";
import { CITY_OFFERS } from "./city-offers";
import { foodInfoData } from "./food-info-seed";

/**
 * «Витрина» — те же 19 предложений, что бегут лентой на главной странице сайта. Раньше лента была
 * статичной картинкой с выдуманными id, из неё нельзя было заказать; теперь это настоящие офферы.
 *
 * Отдельный модуль, а не часть seed.ts, ради syncShowcase(): окна самовывоза живут часы, и обновить
 * витрину нужно без полной очистки БД (seed.ts стирает всё, включая пользователей и их сессии).
 */

const SPB_CENTER = { lat: 59.9311, lng: 30.3609 };
const KM_PER_LAT_DEGREE = 111;
const HOUR_MS = 60 * 60 * 1000;
/** Фото из apps/backend/prisma/seed-images копируются в uploads/offers и раздаются как /uploads/offers/<файл>. */
const UPLOADS_DIR = join(__dirname, "..", "uploads", "offers");

function unsplash(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=75`;
}

interface ShowcaseItem {
  shop: string;
  title: string;
  category: OfferCategory;
  originalPriceRub: number;
  /** Желаемая итоговая скидка на витрине, %: стартовая скидка подбирается так, чтобы с надбавкой за время получилось это число. */
  targetDiscount: number;
  /** Расстояние от центра города — для ленты-витрины (место подбирается «золотым углом»). */
  distanceKm?: number;
  /** Часов до конца окна самовывоза на момент синхронизации. */
  hoursToEnd: number;
  quantityTotal: number;
  weightKg: number;
  /** Файл из seed-images (локальное фото) либо готовый URL; без него витрина покажет плашку категории. */
  image?: { file: string } | { url: string };
  description?: string;
  /** Точное место (городская витрина). Без него координаты считаются от distanceKm. */
  place?: { address: string; lat: number; lng: number };
  featured?: boolean;
}

const { FOOD, BAKERY, FLOWERS, GROCERIES } = OfferCategory;

export const SHOWCASE: ShowcaseItem[] = [
  { shop: "Burger Yard", title: "Даблбургер с беконом и сыром", category: FOOD, originalPriceRub: 450, targetDiscount: 35, distanceKm: 0.5, hoursToEnd: 3.2, quantityTotal: 6, weightKg: 0.45, image: { file: "burger.jpg" } },
  { shop: "Trattoria Uno", title: "Паста Карбонара", category: FOOD, originalPriceRub: 520, targetDiscount: 45, distanceKm: 1.2, hoursToEnd: 2.6, quantityTotal: 5, weightKg: 0.4, image: { file: "carbonara.jpg" } },
  { shop: "Green Bowl", title: "Салат Цезарь с курицей-гриль", category: FOOD, originalPriceRub: 390, targetDiscount: 35, distanceKm: 0.7, hoursToEnd: 3.4, quantityTotal: 6, weightKg: 0.35, image: { file: "caesar-salad.jpg" } },
  { shop: "Fry Corner", title: "Картофель фри, большая порция", category: FOOD, originalPriceRub: 220, targetDiscount: 65, distanceKm: 0.35, hoursToEnd: 0.9, quantityTotal: 8, weightKg: 0.3, image: { file: "fries.jpg" } },
  { shop: "Poke Point", title: "Поке с лососем и манго", category: FOOD, originalPriceRub: 590, targetDiscount: 40, distanceKm: 1.5, hoursToEnd: 3.0, quantityTotal: 4, weightKg: 0.4, image: { file: "poke-salmon-mango.jpg" } },
  { shop: "Cafe Loft", title: "Капучино + молочный коктейль", category: FOOD, originalPriceRub: 380, targetDiscount: 50, distanceKm: 0.3, hoursToEnd: 1.6, quantityTotal: 6, weightKg: 0.5, image: { file: "cappuccino-shake.jpg" } },
  { shop: "Coffee Loop", title: "Капучино на вынос", category: FOOD, originalPriceRub: 250, targetDiscount: 60, distanceKm: 0.15, hoursToEnd: 0.9, quantityTotal: 10, weightKg: 0.3, image: { file: "cappuccino.jpg" } },
  { shop: "Pizza Loft", title: "Пицца Пепперони, половина", category: FOOD, originalPriceRub: 480, targetDiscount: 45, distanceKm: 0.9, hoursToEnd: 3.6, quantityTotal: 5, weightKg: 0.5, image: { file: "pizza-pepperoni.jpg" } },
  { shop: "Sushi Wave", title: "Сет Филадельфия, 8 шт", category: FOOD, originalPriceRub: 890, targetDiscount: 55, distanceKm: 1.8, hoursToEnd: 2.8, quantityTotal: 4, weightKg: 0.45, image: { file: "sushi-philadelphia.jpg" } },
  { shop: "Grill House", title: "Стейк из говядины на гриле", category: FOOD, originalPriceRub: 990, targetDiscount: 40, distanceKm: 2.1, hoursToEnd: 3.8, quantityTotal: 3, weightKg: 0.35, image: { file: "steak.jpg" } },
  { shop: "Shava Point", title: "Шаурма классическая с говядиной", category: FOOD, originalPriceRub: 320, targetDiscount: 60, distanceKm: 0.4, hoursToEnd: 0.95, quantityTotal: 8, weightKg: 0.4, image: { file: "shawarma.jpg" } },
  { shop: "Thai Wok", title: "Том Ям с креветками", category: FOOD, originalPriceRub: 550, targetDiscount: 45, distanceKm: 1.3, hoursToEnd: 2.9, quantityTotal: 5, weightKg: 0.5, image: { file: "tom-yum.jpg" } },
  { shop: "Thai Wok", title: "Лапша Пад Тай с курицей", category: FOOD, originalPriceRub: 480, targetDiscount: 70, distanceKm: 1.3, hoursToEnd: 0.9, quantityTotal: 4, weightKg: 0.45, image: { file: "pad-thai.jpg" } },
  { shop: "Sonnig Bakery", title: "Круассаны и багеты, набор", category: BAKERY, originalPriceRub: 340, targetDiscount: 55, distanceKm: 0.65, hoursToEnd: 2.4, quantityTotal: 7, weightKg: 0.4, image: { url: unsplash("photo-1509440159596-0249088772ff") } },
  { shop: "Хлеб и Соль", title: "Пироги с ягодами, 2 шт", category: BAKERY, originalPriceRub: 420, targetDiscount: 40, distanceKm: 0.9, hoursToEnd: 3.3, quantityTotal: 6, weightKg: 0.5, image: { url: unsplash("photo-1488477181946-6428a0291777") } },
  { shop: "Полевой цветочный", title: "Букет дня — микс сезонных", category: FLOWERS, originalPriceRub: 1490, targetDiscount: 40, distanceKm: 1.4, hoursToEnd: 2.7, quantityTotal: 3, weightKg: 0.5, image: { url: unsplash("photo-1487070183336-b863922373d4") } },
  { shop: "GreenHouse Flowers", title: "Моно-букет: пионы", category: FLOWERS, originalPriceRub: 2200, targetDiscount: 70, distanceKm: 2.0, hoursToEnd: 0.9, quantityTotal: 2, weightKg: 0.4, image: { url: unsplash("photo-1487070183336-b863922373d4") } },
  { shop: "Свежий Корнер", title: "Овощи и фрукты, набор дня", category: GROCERIES, originalPriceRub: 650, targetDiscount: 60, distanceKm: 0.3, hoursToEnd: 0.95, quantityTotal: 8, weightKg: 1.5, image: { url: unsplash("photo-1542838132-92c53300491e") } },
  { shop: "Маркет Дня", title: "Молочная линейка, набор", category: GROCERIES, originalPriceRub: 380, targetDiscount: 45, distanceKm: 0.8, hoursToEnd: 3.1, quantityTotal: 6, weightKg: 1.2, image: { url: unsplash("photo-1542838132-92c53300491e") } },
];

/** Все предложения витрины: лента на главной (у центра) + городская витрина по районам. */
export function allShowcaseItems(): ShowcaseItem[] {
  const fromCity: ShowcaseItem[] = CITY_OFFERS.map((o) => ({
    shop: o.shop,
    title: o.title,
    description: o.description,
    category: o.category,
    originalPriceRub: o.originalPriceRub,
    targetDiscount: o.targetDiscount,
    hoursToEnd: o.hoursToEnd,
    quantityTotal: o.quantityTotal,
    weightKg: o.weightKg,
    image: o.image,
    place: { address: o.address, lat: o.lat, lng: o.lng },
    featured: o.featured,
  }));
  return [...SHOWCASE, ...fromCity];
}

function slugify(name: string): string {
  const map: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya" };
  return name
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Равномерно «рассыпает» заведения вокруг центра (золотой угол), сохраняя заданное расстояние. */
export function placeAround(distanceKm: number, index: number) {
  const angle = ((index * 137.5) % 360) * (Math.PI / 180);
  const lngKmPerDegree = KM_PER_LAT_DEGREE * Math.cos((SPB_CENTER.lat * Math.PI) / 180);
  return {
    lat: SPB_CENTER.lat + (distanceKm * Math.sin(angle)) / KM_PER_LAT_DEGREE,
    lng: SPB_CENTER.lng + (distanceKm * Math.cos(angle)) / lngKmPerDegree,
  };
}

export function discountFor(item: ShowcaseItem) {
  // Подбираем стартовую скидку так, чтобы вместе с надбавкой за оставшееся время получилось targetDiscount.
  const bonus = computeDiscountPercent(0, item.hoursToEnd);
  const base = Math.max(25, item.targetDiscount - bonus);
  return { baseDiscountPercent: base, discountPercent: computeDiscountPercent(base, item.hoursToEnd) };
}

function resolveImageUrl(image: ShowcaseItem["image"]): string | undefined {
  if (!image) return undefined;
  if ("url" in image) return image.url;
  mkdirSync(UPLOADS_DIR, { recursive: true });
  const source = join(__dirname, "seed-images", image.file);
  if (!existsSync(source)) throw new Error(`Нет файла витрины: ${source}`);
  copyFileSync(source, join(UPLOADS_DIR, image.file));
  return `/uploads/offers/${image.file}`;
}

/**
 * Идемпотентно приводит витрину к «свежему» состоянию: заведения/офферы создаются или обновляются
 * (по владельцу и названию), окна самовывоза пересчитываются от «сейчас». Пользователей и заказы не трогает;
 * остаток считается с учётом уже оформленных заказов — чтобы повторный запуск не «воскрешал» купленное.
 */
export async function syncShowcase(prisma: PrismaClient, passwordHash: string): Promise<number> {
  const now = Date.now();
  let synced = 0;

  for (const [index, item] of allShowcaseItems().entries()) {
    const email = `showcase.${slugify(item.shop)}@apetite.ru`;
    const owner = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, name: `${item.shop} (владелец)`, role: Role.BUSINESS },
    });

    const { lat, lng } = item.place ?? placeAround(item.distanceKm ?? 1, index);
    const existingBusiness = await prisma.business.findFirst({ where: { ownerUserId: owner.id, name: item.shop } });
    const businessData = {
      category: item.category,
      address: item.place?.address ?? `Санкт-Петербург, ${item.shop}`,
      lat,
      lng,
      status: BusinessStatus.ACTIVE,
      commissionPercent: PLATFORM_COMMISSION_PERCENT,
    };
    const business = existingBusiness
      ? await prisma.business.update({ where: { id: existingBusiness.id }, data: businessData })
      : await prisma.business.create({ data: { ownerUserId: owner.id, name: item.shop, ...businessData } });

    const { baseDiscountPercent, discountPercent } = discountFor(item);
    const originalPrice = item.originalPriceRub * 100;
    const discountedPrice = Math.round((originalPrice * (100 - discountPercent)) / 100);
    const window = { pickupStart: new Date(now - HOUR_MS), pickupEnd: new Date(now + item.hoursToEnd * HOUR_MS) };
    const foodInfo = foodInfoData(item.title, item.category, window.pickupEnd);

    const existingOffer = await prisma.offer.findFirst({ where: { businessId: business.id, title: item.title } });
    if (existingOffer) {
      const sold = await prisma.order.aggregate({
        where: { offerId: existingOffer.id, status: { in: [OrderStatus.CONFIRMED, OrderStatus.COMPLETED] } },
        _sum: { quantity: true },
      });
      const quantityLeft = Math.max(0, item.quantityTotal - (sold._sum.quantity ?? 0));
      await prisma.offer.update({
        where: { id: existingOffer.id },
        data: {
          ...window,
          ...foodInfo,
          originalPrice,
          discountedPrice,
          discountPercent,
          baseDiscountPercent,
          imageUrl: resolveImageUrl(item.image),
          description: item.description,
          featured: item.featured ?? false,
          quantityTotal: item.quantityTotal,
          quantityLeft,
          status: quantityLeft > 0 ? OfferStatus.ACTIVE : OfferStatus.SOLD_OUT,
        },
      });
    } else {
      await prisma.offer.create({
        data: {
          businessId: business.id,
          title: item.title,
          category: item.category,
          originalPrice,
          discountedPrice,
          discountPercent,
          baseDiscountPercent,
          imageUrl: resolveImageUrl(item.image),
          description: item.description,
          featured: item.featured ?? false,
          quantityTotal: item.quantityTotal,
          quantityLeft: item.quantityTotal,
          weightKg: item.weightKg,
          ...window,
          ...foodInfo,
          status: OfferStatus.ACTIVE,
        },
      });
    }
    synced += 1;
  }
  return synced;
}
