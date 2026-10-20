import {
  BusinessStatus,
  OfferCategory,
  OfferStatus,
  OrderStatus,
  Prisma,
  PrismaClient,
  Role,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { syncShowcase } from "./showcase";
import { foodInfoData } from "./food-info-seed";
import {
  computeDiscountPercent,
  ECO_POINTS_PER_KG,
  PICKUP_CODE_LENGTH,
  PLATFORM_COMMISSION_PERCENT,
  type WorkingHours,
} from "@apetite/shared";

const prisma = new PrismaClient();

const SPB_CENTER = { lat: 59.9311, lng: 30.3609 };
const KM_PER_LAT_DEGREE = 111;

/** Грубое смещение координат на deltaKm километров — достаточно для тестовых данных. */
function offsetCoords(deltaLatKm: number, deltaLngKm: number) {
  const lngKmPerDegree = KM_PER_LAT_DEGREE * Math.cos((SPB_CENTER.lat * Math.PI) / 180);
  return {
    lat: SPB_CENTER.lat + deltaLatKm / KM_PER_LAT_DEGREE,
    lng: SPB_CENTER.lng + deltaLngKm / lngKmPerDegree,
  };
}

function generatePickupCode(): string {
  const max = 10 ** PICKUP_CODE_LENGTH;
  return Math.floor(Math.random() * max).toString().padStart(PICKUP_CODE_LENGTH, "0");
}

const HOUR_MS = 60 * 60 * 1000;

/** Фото товара — прямые CDN-ссылки на Unsplash, без ключа/аккаунта (только для тестовых данных). */
function unsplash(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=75`;
}

interface OfferSeed {
  title: string;
  category: OfferCategory;
  originalPriceRub: number;
  weightKg: number;
  quantityTotal: number;
  hoursToEnd: number;
  /** Стартовая скидка, заданная владельцем бизнеса (минимум 25%). */
  baseDiscountPercent: number;
  /** Фото товара — без него витрина показывает иконку категории вместо реального вида товара. */
  imageUrl: string;
}

interface BusinessSeed {
  ownerEmail: string;
  name: string;
  category: OfferCategory;
  address: string;
  deltaLatKm: number;
  deltaLngKm: number;
  /** Часы работы (ISO-день → интервал или null); офферы через API обязаны в них укладываться. */
  workingHours: WorkingHours;
  offers: OfferSeed[];
}

const daily = (open: string, close: string): WorkingHours => ({ "1": { open, close }, "2": { open, close }, "3": { open, close }, "4": { open, close }, "5": { open, close }, "6": { open, close }, "7": { open, close } });

const BUSINESS_SEEDS: BusinessSeed[] = [
  {
    ownerEmail: "cafe.pushkin@apetite.ru",
    name: "Кафе Пушкинъ",
    // Круглосуточно — чтобы тесты и демо могли создавать офферы в любое время суток.
    workingHours: daily("00:00", "00:00"),
    category: OfferCategory.FOOD,
    address: "Невский проспект, 40, Санкт-Петербург",
    deltaLatKm: 0.3,
    deltaLngKm: 0.2,
    offers: [
      {
        title: "Бизнес-ланч (не разобранный)",
        category: OfferCategory.FOOD,
        originalPriceRub: 900,
        weightKg: 0.6,
        quantityTotal: 8,
        hoursToEnd: 2.5,
        baseDiscountPercent: 30,
        imageUrl: unsplash("photo-1547592166-23ac45744acd"),
      },
      {
        title: "Набор десертов дня",
        category: OfferCategory.BAKERY,
        originalPriceRub: 600,
        weightKg: 0.4,
        quantityTotal: 6,
        hoursToEnd: 0.8,
        baseDiscountPercent: 40,
        imageUrl: unsplash("photo-1488477181946-6428a0291777"),
      },
    ],
  },
  {
    ownerEmail: "bulka.arbat@apetite.ru",
    name: "Булочная на Рубинштейна",
    workingHours: daily("07:00", "21:00"),
    category: OfferCategory.BAKERY,
    address: "ул. Рубинштейна, 10, Санкт-Петербург",
    deltaLatKm: -0.5,
    deltaLngKm: 0.6,
    offers: [
      {
        title: "Выпечка к закрытию",
        category: OfferCategory.BAKERY,
        originalPriceRub: 450,
        weightKg: 0.3,
        quantityTotal: 12,
        hoursToEnd: 1.5,
        baseDiscountPercent: 25,
        imageUrl: unsplash("photo-1509440159596-0249088772ff"),
      },
    ],
  },
  {
    ownerEmail: "flowers.mos@apetite.ru",
    name: "Цветочная мастерская СПб",
    workingHours: { ...daily("09:00", "20:00"), "7": { open: "10:00", close: "18:00" } },
    category: OfferCategory.FLOWERS,
    address: "наб. реки Фонтанки, 5, Санкт-Петербург",
    deltaLatKm: 0.8,
    deltaLngKm: -0.4,
    offers: [
      {
        title: "Букеты, требующие обновления",
        category: OfferCategory.FLOWERS,
        originalPriceRub: 2500,
        weightKg: 0.5,
        quantityTotal: 4,
        hoursToEnd: 3,
        baseDiscountPercent: 50,
        imageUrl: unsplash("photo-1487070183336-b863922373d4"),
      },
    ],
  },
  {
    ownerEmail: "market.svezhest@apetite.ru",
    name: "Магазин Свежесть",
    workingHours: daily("08:00", "23:00"),
    category: OfferCategory.GROCERIES,
    address: "Приморский пр-т, 45, Санкт-Петербург",
    deltaLatKm: -0.2,
    deltaLngKm: -0.7,
    offers: [
      {
        title: "Продуктовый набор на вечер",
        category: OfferCategory.GROCERIES,
        originalPriceRub: 700,
        weightKg: 1.2,
        quantityTotal: 10,
        hoursToEnd: 4,
        baseDiscountPercent: 35,
        imageUrl: unsplash("photo-1542838132-92c53300491e"),
      },
    ],
  },
];

async function main() {
  console.log("Очистка данных...");
  // Порядок важен из-за внешних ключей: сначала зависимые таблицы.
  await prisma.notification.deleteMany();
  await prisma.ecoTransaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  console.log("Создание пользователей admin/user...");
  const admin = await prisma.user.create({
    data: {
      email: "admin@apetite.ru",
      passwordHash,
      name: "Платформенный админ",
      role: Role.ADMIN,
    },
  });

  const demoUser = await prisma.user.create({
    data: {
      email: "user@apetite.ru",
      passwordHash,
      name: "Тестовый пользователь",
      role: Role.USER,
      // Рядом с центром Санкт-Петербурга — чтобы гео-дайджест "рядом с тобой N предложений" (ШАГ 6)
      // сразу находил сидовые заведения, а не требовал ручного PATCH /users/me/location.
      lastLat: SPB_CENTER.lat,
      lastLng: SPB_CENTER.lng,
      expoPushToken: "ExponentPushToken[demo-seed-token]",
    },
  });

  console.log("Создание заведений и офферов...");
  const createdOffers: { businessId: string; offerId: string; discountedPrice: number; weightKg: number }[] = [];

  for (const businessSeed of BUSINESS_SEEDS) {
    const owner = await prisma.user.create({
      data: {
        email: businessSeed.ownerEmail,
        passwordHash,
        name: `${businessSeed.name} (владелец)`,
        role: Role.BUSINESS,
      },
    });

    const { lat, lng } = offsetCoords(businessSeed.deltaLatKm, businessSeed.deltaLngKm);

    const business = await prisma.business.create({
      data: {
        ownerUserId: owner.id,
        name: businessSeed.name,
        category: businessSeed.category,
        address: businessSeed.address,
        lat,
        lng,
        status: BusinessStatus.ACTIVE, // ручной онбординг админом — сразу активно (ШАГ 0)
        commissionPercent: PLATFORM_COMMISSION_PERCENT,
        workingHours: businessSeed.workingHours as unknown as Prisma.InputJsonObject,
      },
    });

    for (const offerSeed of businessSeed.offers) {
      const now = Date.now();
      const pickupEnd = new Date(now + offerSeed.hoursToEnd * HOUR_MS);
      const pickupStart = new Date(now - HOUR_MS);
      const discountPercent = computeDiscountPercent(offerSeed.baseDiscountPercent, offerSeed.hoursToEnd);
      const originalPrice = offerSeed.originalPriceRub * 100; // в копейки
      const discountedPrice = Math.round((originalPrice * (100 - discountPercent)) / 100);

      const offer = await prisma.offer.create({
        data: {
          businessId: business.id,
          title: offerSeed.title,
          category: offerSeed.category,
          originalPrice,
          discountedPrice,
          discountPercent,
          baseDiscountPercent: offerSeed.baseDiscountPercent,
          imageUrl: offerSeed.imageUrl,
          quantityTotal: offerSeed.quantityTotal,
          quantityLeft: offerSeed.quantityTotal,
          weightKg: offerSeed.weightKg,
          pickupStart,
          pickupEnd,
          status: OfferStatus.ACTIVE,
          ...foodInfoData(offerSeed.title, offerSeed.category, pickupEnd),
        },
      });

      createdOffers.push({
        businessId: business.id,
        offerId: offer.id,
        discountedPrice,
        weightKg: offerSeed.weightKg,
      });
    }
  }

  console.log("Витрина: офферы с ленты на главной...");
  const showcaseCount = await syncShowcase(prisma, passwordHash);

  console.log("Создание демо-заказов и эко-транзакции...");
  const [completedOfferSeed, pendingOfferSeed] = createdOffers;

  // Заказ 1: уже забран пользователем — есть эко-транзакция.
  const completedQuantity = 1;
  const completedOffer = await prisma.offer.update({
    where: { id: completedOfferSeed.offerId },
    data: { quantityLeft: { decrement: completedQuantity } },
  });
  const completedTotal = completedOfferSeed.discountedPrice * completedQuantity;
  const completedFee = Math.round((completedTotal * PLATFORM_COMMISSION_PERCENT) / 100);

  const completedOrder = await prisma.order.create({
    data: {
      userId: demoUser.id,
      offerId: completedOfferSeed.offerId,
      businessId: completedOfferSeed.businessId,
      quantity: completedQuantity,
      totalPrice: completedTotal,
      platformFee: completedFee,
      status: OrderStatus.COMPLETED,
      pickupCode: generatePickupCode(),
      completedAt: new Date(),
    },
  });

  await prisma.payment.create({
    data: {
      orderId: completedOrder.id,
      provider: "mock",
      externalId: `mock_seed_${completedOrder.id}`,
      amount: completedTotal,
      currency: "RUB",
      status: "SUCCEEDED",
    },
  });

  const weightSavedKg = completedOfferSeed.weightKg * completedQuantity;
  await prisma.ecoTransaction.create({
    data: {
      userId: demoUser.id,
      orderId: completedOrder.id,
      points: Math.round(weightSavedKg * ECO_POINTS_PER_KG),
      weightSavedKg,
    },
  });

  await prisma.notification.create({
    data: {
      userId: demoUser.id,
      type: "ORDER_COMPLETED",
      title: "Заказ забран",
      body: `Спасибо! Ты спас(-ла) ${weightSavedKg.toFixed(1)} кг еды от выброса.`,
      data: { orderId: completedOrder.id },
      read: true,
    },
  });

  // Заказ 2: оплачен, ожидает самовывоза.
  const pendingQuantity = 1;
  await prisma.offer.update({
    where: { id: pendingOfferSeed.offerId },
    data: { quantityLeft: { decrement: pendingQuantity } },
  });
  const pendingTotal = pendingOfferSeed.discountedPrice * pendingQuantity;
  const pendingFee = Math.round((pendingTotal * PLATFORM_COMMISSION_PERCENT) / 100);

  const pendingOrder = await prisma.order.create({
    data: {
      userId: demoUser.id,
      offerId: pendingOfferSeed.offerId,
      businessId: pendingOfferSeed.businessId,
      quantity: pendingQuantity,
      totalPrice: pendingTotal,
      platformFee: pendingFee,
      status: OrderStatus.CONFIRMED,
      pickupCode: generatePickupCode(),
    },
  });

  await prisma.payment.create({
    data: {
      orderId: pendingOrder.id,
      provider: "mock",
      externalId: `mock_seed_${pendingOrder.id}`,
      amount: pendingTotal,
      currency: "RUB",
      status: "SUCCEEDED",
    },
  });

  await prisma.notification.create({
    data: {
      userId: demoUser.id,
      type: "PICKUP_REMINDER",
      title: "Скоро закрытие самовывоза",
      body: "Не забудь забрать заказ до конца окна самовывоза.",
      data: { orderId: pendingOrder.id },
      read: false,
    },
  });

  console.log("Готово:");
  console.log(`  admin:     ${admin.email} / password123`);
  console.log(`  user:      ${demoUser.email} / password123`);
  console.log(`  businesses: ${BUSINESS_SEEDS.map((b) => b.ownerEmail).join(", ")} / password123`);
  console.log(`  showcase offers: ${showcaseCount} (showcase.<shop>@apetite.ru / password123)`);
  console.log(`  offers: ${createdOffers.length}, completed order: ${completedOrder.id}, pending order: ${pendingOrder.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
