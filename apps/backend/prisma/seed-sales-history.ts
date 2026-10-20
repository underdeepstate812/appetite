import path from "node:path";
import { config } from "dotenv";
import * as bcrypt from "bcryptjs";
import { OfferCategory, OfferStatus, OrderStatus, PrismaClient, DiscountMode, Role } from "@prisma/client";
import { ECO_POINTS_PER_KG, PICKUP_CODE_LENGTH, PLATFORM_COMMISSION_PERCENT, SALES_TIME_ZONE, addDays, zonedParts, zonedTimeToUtc } from "@apetite/shared";

/**
 * Демо-история продаж для графика в кабинете (страница «Аналитика»): ~40 дней архивных офферов и заказов у
 * кафе «Пушкинъ» (cafe.pushkin@apetite.ru). Идемпотентно: свои офферы помечены описанием и пересоздаются, остальные данные не трогаем.
 * Запуск: pnpm --filter @apetite/backend prisma:seed:sales-history
 */
config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });
const prisma = new PrismaClient();

const MARK = "demo-sales-history";
const DAYS = 40;
const HOUR = 3_600_000;

/** Детерминированный «случайный» ряд — один и тот же график при каждом запуске. */
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: "cafe.pushkin@apetite.ru" } });
  const business = owner ? await prisma.business.findFirst({ where: { ownerUserId: owner.id } }) : null;
  if (!owner || !business) throw new Error("Нет демо-аккаунтов: сначала pnpm --filter @apetite/backend prisma:seed");

  // Отдельные покупатели, чтобы демо-история не засоряла заказы демо-аккаунта user@apetite.ru.
  const passwordHash = await bcrypt.hash("password123", 10);
  const buyers = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((n) =>
      prisma.user.upsert({ where: { email: `demo.buyer${n}@apetite.ru` }, update: {}, create: { email: `demo.buyer${n}@apetite.ru`, passwordHash, name: `Демо-покупатель ${n}`, role: Role.USER } })
    )
  );

  const old = await prisma.offer.findMany({ where: { businessId: business.id, description: MARK }, select: { id: true } });
  if (old.length) {
    const ids = old.map((offer) => offer.id);
    await prisma.order.deleteMany({ where: { offerId: { in: ids } } });
    await prisma.offer.deleteMany({ where: { id: { in: ids } } });
  }

  const random = rng(20261018);
  const today = zonedParts(Date.now(), SALES_TIME_ZONE).date;
  const titles = ["Набор выпечки дня", "Бизнес-ланч (не распроданный)", "Десерты дня", "Хлеб и булочки"];
  let orders = 0;

  for (let back = DAYS - 1; back >= 0; back--) {
    const date = addDays(today, -back);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 — вс
    const weekend = weekday === 0 || weekday === 6;
    const growth = 1 + (DAYS - back) / DAYS; // к сегодняшнему дню продаж больше
    const base = (weekend ? 6.5 : 3.8) * growth * (0.65 + random() * 0.7);
    const visitors = Math.max(0, Math.round(base) - (random() < 0.08 ? 3 : 0)); // изредка «провал» — праздник/дождь

    const pickupStart = zonedTimeToUtc(date, "17:00", SALES_TIME_ZONE);
    const pickupEnd = zonedTimeToUtc(date, "21:00", SALES_TIME_ZONE);
    const original = 45000 + Math.round(random() * 4) * 5000;
    const baseDiscount = 40;
    const title = titles[(DAYS - back) % titles.length];
    const offer = await prisma.offer.create({
      data: {
        businessId: business.id, title, description: MARK, category: OfferCategory.BAKERY,
        originalPrice: original, discountedPrice: Math.round(original * 0.6), discountPercent: baseDiscount, baseDiscountPercent: baseDiscount,
        discountMode: DiscountMode.DYNAMIC, quantityTotal: 12, quantityLeft: 12, weightKg: 0.4, pickupStart, pickupEnd,
        status: OfferStatus.ARCHIVED, ingredients: "Мука, масло, молоко, сахар", allergens: ["gluten", "milk"], allergensDeclared: true,
        bestBefore: new Date(pickupEnd.getTime() + 8 * HOUR),
      },
    });

    let sold = 0;
    for (let index = 0; index < visitors; index++) {
      // Когда покупают: чаще всего в последние 2 часа (горячая цена), реже заранее.
      const roll = random();
      const hoursToEnd = roll < 0.18 ? 4.2 + random() * 1.8 : roll < 0.38 ? 2 + random() * 2 : roll < 0.66 ? 1 + random() : random();
      const createdAt = new Date(pickupEnd.getTime() - hoursToEnd * HOUR - random() * 600_000);
      if (createdAt.getTime() > Date.now()) continue;
      const percent = hoursToEnd < 1 ? 60 : hoursToEnd < 2 ? 50 : baseDiscount;
      const quantity = random() < 0.2 ? 2 : 1;
      if (sold + quantity > 12) break;
      sold += quantity;
      const unit = Math.round((original * (100 - percent)) / 100);
      const total = unit * quantity;
      const fate = random();
      const isToday = back === 0;
      const status = isToday && createdAt.getTime() > Date.now() - 3 * HOUR ? OrderStatus.CONFIRMED : fate < 0.08 ? OrderStatus.CANCELLED : fate < 0.12 ? OrderStatus.EXPIRED : OrderStatus.COMPLETED;
      const order = await prisma.order.create({
        data: {
          userId: buyers[Math.floor(random() * buyers.length)].id, offerId: offer.id, businessId: business.id, quantity, totalPrice: total,
          platformFee: Math.round((total * PLATFORM_COMMISSION_PERCENT) / 100), status, createdAt,
          pickupCode: Math.floor(random() * 10 ** PICKUP_CODE_LENGTH).toString().padStart(PICKUP_CODE_LENGTH, "0"),
          ...(status === OrderStatus.COMPLETED ? { completedAt: new Date(Math.min(pickupEnd.getTime(), createdAt.getTime() + HOUR)) } : {}),
        },
      });
      orders++;
      if (status === OrderStatus.COMPLETED) {
        await prisma.payment.create({ data: { orderId: order.id, provider: "mock", externalId: `mock_demo_${order.id}`, amount: total, currency: "RUB", status: "SUCCEEDED" } });
        const kg = 0.4 * quantity;
        await prisma.ecoTransaction.create({ data: { userId: order.userId, orderId: order.id, points: Math.round(kg * ECO_POINTS_PER_KG), weightSavedKg: kg, createdAt } });
      }
    }
    await prisma.offer.update({ where: { id: offer.id }, data: { quantityLeft: 12 - sold } });
  }
  console.log(`Демо-история продаж: ${DAYS} дн., ${orders} заказов у «${business.name}».`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
