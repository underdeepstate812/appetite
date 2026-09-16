import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OfferStatus, OrderStatus } from "@prisma/client";
import { DISCOUNT_RULES } from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface SchedulerRunResult {
  offersRecalculated: number;
  offersArchived: number;
  ordersExpired: number;
}

/** >2ч — база 50%, 1–2ч — +10%, <1ч — +20% (капается MAX_PERCENT). Правило из ШАГ 0. */
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

@Injectable()
export class DiscountSchedulerService {
  private readonly logger = new Logger(DiscountSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Аргумент декоратора вычисляется при загрузке класса, до DI — ConfigService тут
  // ещё недоступен, поэтому берём env напрямую (main.ts грузит .env раньше импорта модулей).
  @Cron(process.env.DISCOUNT_CRON_EXPRESSION ?? "*/15 * * * *")
  async handleCron() {
    const result = await this.run();
    this.logger.log(
      `Шедулер скидок: пересчитано ${result.offersRecalculated}, заархивировано ${result.offersArchived}, заказов просрочено ${result.ordersExpired}`
    );
  }

  /** Пересчёт скидок активных офферов + перевод просроченных заказов в EXPIRED. */
  async run(): Promise<SchedulerRunResult> {
    const [offersRecalculated, offersArchived] = await this.recalculateDiscounts();
    const ordersExpired = await this.expireStaleOrders();
    return { offersRecalculated, offersArchived, ordersExpired };
  }

  private async recalculateDiscounts(): Promise<[number, number]> {
    const now = new Date();
    const activeOffers = await this.prisma.offer.findMany({
      where: { status: OfferStatus.ACTIVE },
    });

    let recalculated = 0;
    let archived = 0;

    for (const offer of activeOffers) {
      const hoursToEnd = (offer.pickupEnd.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursToEnd <= 0) {
        await this.prisma.offer.update({
          where: { id: offer.id },
          data: { status: OfferStatus.ARCHIVED },
        });
        archived++;
        continue;
      }

      const discountPercent = computeDiscountPercent(hoursToEnd);
      if (discountPercent !== offer.discountPercent) {
        const discountedPrice = Math.round((offer.originalPrice * (100 - discountPercent)) / 100);
        await this.prisma.offer.update({
          where: { id: offer.id },
          data: { discountPercent, discountedPrice },
        });
        recalculated++;
      }
    }

    return [recalculated, archived];
  }

  private async expireStaleOrders(): Promise<number> {
    const now = new Date();
    // updateMany не умеет фильтровать по связанной таблице — сначала находим id через findMany.
    const staleOrders = await this.prisma.order.findMany({
      where: { status: OrderStatus.CONFIRMED, offer: { pickupEnd: { lt: now } } },
      select: { id: true },
    });
    if (staleOrders.length === 0) return 0;

    const result = await this.prisma.order.updateMany({
      where: { id: { in: staleOrders.map((o) => o.id) } },
      data: { status: OrderStatus.EXPIRED },
    });
    return result.count;
  }
}
