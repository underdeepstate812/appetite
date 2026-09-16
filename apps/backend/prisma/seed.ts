import {
  BusinessStatus,
  OfferCategory,
  OfferStatus,
  OrderStatus,
  PrismaClient,
  Role,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import {
  DISCOUNT_RULES,
  ECO_POINTS_PER_KG,
  PICKUP_CODE_LENGTH,
  PLATFORM_COMMISSION_PERCENT,
} from "@apetite/shared";

const prisma = new PrismaClient();

const MOSCOW_CENTER = { lat: 55.751244, lng: 37.618423 };
const KM_PER_LAT_DEGREE = 111;

/** Грубое смещение координат на deltaKm километров — достаточно для тестовых данных. */
function offsetCoords(deltaLatKm: number, deltaLngKm: number) {
  const lngKmPerDegree = KM_PER_LAT_DEGREE * Math.cos((MOSCOW_CENTER.lat * Math.PI) / 180);
  return {
    lat: MOSCOW_CENTER.lat + deltaLatKm / KM_PER_LAT_DEGREE,
    lng: MOSCOW_CENTER.lng + deltaLngKm / lngKmPerDegree,
  };
}

/** Повторяет правило скидок из ШАГ 5 (шедулер) — здесь только для реалистичных сид-данных. */
function computeDiscountPercent(hoursToEnd: number): number {
  if (hoursToEnd < DISCOUNT_RULES.TIER_3_HOURS_BEFORE_END) {
    return Math.min(
      DISCOUNT_RULES.BASE_PERCENT + DISCOUNT_RULES.TIER_3_BONUS_PERCENT,
      DISCOUNT_RULES.MAX_PERCENT
    );
  }
  if (hoursToEnd < DISCOUNT_RULES.TIER_1_HOURS_BEFORE_END) {
    return DISCOUNT_RULES.BASE_PERCENT + DISCOUNT_RULES.TIER_2_BONUS_PERCENT;
  }
  return DISCOUNT_RULES.BASE_PERCENT;
}

function generatePickupCode(): string {
  const max = 10 ** PICKUP_CODE_LENGTH;
  return Math.floor(Math.random() * max).toString().padStart(PICKUP_CODE_LENGTH, "0");
}

const HOUR_MS = 60 * 60 * 1000;

interface OfferSeed {
  title: string;
  category: OfferCategory;
  originalPriceRub: number;
  weightKg: number;
  quantityTotal: number;
  hoursToEnd: number;
}

interface BusinessSeed {
  ownerEmail: string;
  name: string;
  category: OfferCategory;
  address: string;
  deltaLatKm: number;
  deltaLngKm: number;
  offers: OfferSeed[];
}

const BUSINESS_SEEDS: BusinessSeed[] = [
  {
    ownerEmail: "cafe.pushkin@apetite.ru",
    name: "Кафе Пушкинъ",
    category: OfferCategory.FOOD,
    address: "ул. Тверская, 26а, Москва",
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
      },
      {
        title: "Набор десертов дня",
        category: OfferCategory.BAKERY,
        originalPriceRub: 600,
        weightKg: 0.4,
        quantityTotal: 6,
        hoursToEnd: 0.8,
      },
    ],
  },
  {
    ownerEmail: "bulka.arbat@apetite.ru",
    name: "Булочная на Арбате",
    category: OfferCategory.BAKERY,
    address: "Арбат, 10, Москва",
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
      },
    ],
  },
  {
    ownerEmail: "flowers.mos@apetite.ru",
    name: "Цветочная мастерская МОС",
    category: OfferCategory.FLOWERS,
    address: "Кутузовский пр-т, 5, Москва",
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
      },
    ],
  },
  {
    ownerEmail: "market.svezhest@apetite.ru",
    name: "Магазин Свежесть",
    category: OfferCategory.GROCERIES,
    address: "Ленинский пр-т, 45, Москва",
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
      },
    ],
  },
];

async function main() {
  console.log("Очистка данных...");
  // Порядок важен из-за внешних ключей: сначала зависимые таблицы.
  await prisma.notification.deleteMany();
  await prisma.ecoTransaction.deleteMany();
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
      },
    });

    for (const offerSeed of businessSeed.offers) {
      const now = Date.now();
      const pickupEnd = new Date(now + offerSeed.hoursToEnd * HOUR_MS);
      const pickupStart = new Date(now - HOUR_MS);
      const discountPercent = computeDiscountPercent(offerSeed.hoursToEnd);
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
          quantityTotal: offerSeed.quantityTotal,
          quantityLeft: offerSeed.quantityTotal,
          weightKg: offerSeed.weightKg,
          pickupStart,
          pickupEnd,
          status: OfferStatus.ACTIVE,
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
      type: "ORDER_CONFIRMED",
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
