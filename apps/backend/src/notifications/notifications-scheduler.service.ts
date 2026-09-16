import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { NotificationType, OrderStatus, Prisma } from "@prisma/client";
import { NEARBY_DIGEST_THROTTLE_HOURS, PICKUP_REMINDER_WINDOW_MINUTES } from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

export interface NotificationsRunResult {
  nearbyDigestsSent: number;
  pickupRemindersSent: number;
}

interface NearbyDigestRow {
  userId: string;
  cnt: number;
}

function pluralizeOffers(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "предложение";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "предложения";
  return "предложений";
}

@Injectable()
export class NotificationsSchedulerService {
  private readonly logger = new Logger(NotificationsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  // Тот же каданс, что у пересчёта скидок (ШАГ 5) — один общий "пульс" для беты,
  // не нужно гонять несколько параллельных cron-расписаний.
  @Cron(process.env.DISCOUNT_CRON_EXPRESSION ?? "*/15 * * * *")
  async handleCron() {
    const result = await this.run();
    this.logger.log(
      `Уведомления: гео-дайджестов отправлено ${result.nearbyDigestsSent}, напоминаний о самовывозе ${result.pickupRemindersSent}`
    );
  }

  async run(): Promise<NotificationsRunResult> {
    const nearbyDigestsSent = await this.sendNearbyOffersDigest();
    const pickupRemindersSent = await this.sendPickupReminders();
    return { nearbyDigestsSent, pickupRemindersSent };
  }

  /**
   * "Рядом с тобой N предложений" — раз в NEARBY_DIGEST_THROTTLE_HOURS на пользователя,
   * чтобы не спамить при каждом новом оффере. Haversine в одном SQL-запросе по всем
   * пользователям сразу (без N+1), группировка + фильтр по существующим уведомлениям.
   */
  private async sendNearbyOffersDigest(): Promise<number> {
    const rows = await this.prisma.$queryRaw<NearbyDigestRow[]>(Prisma.sql`
      SELECT u.id AS "userId", COUNT(*)::int AS cnt
      FROM users u
      JOIN businesses b ON (
        6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians(u."lastLat")) * cos(radians(b."lat")) * cos(radians(b."lng") - radians(u."lastLng"))
            + sin(radians(u."lastLat")) * sin(radians(b."lat"))
          ))
        )
      ) <= u."notifyRadiusKm"
      JOIN offers o ON o."businessId" = b.id AND o.status = 'ACTIVE'
      WHERE u.role = 'USER'
        AND u."lastLat" IS NOT NULL
        AND u."lastLng" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n."userId" = u.id
            AND n.type = 'NEARBY_OFFERS'
            AND n."createdAt" > NOW() - (${NEARBY_DIGEST_THROTTLE_HOURS}::float * INTERVAL '1 hour')
        )
      GROUP BY u.id
    `);

    for (const row of rows) {
      await this.notifications.createAndNotify(
        row.userId,
        NotificationType.NEARBY_OFFERS,
        "Рядом с тобой новые предложения",
        `Сейчас поблизости ${row.cnt} ${pluralizeOffers(row.cnt)} со скидкой.`,
        { count: String(row.cnt) }
      );
    }
    return rows.length;
  }

  /** За PICKUP_REMINDER_WINDOW_MINUTES до pickupEnd — один раз на заказ (pickupReminderSentAt). */
  private async sendPickupReminders(): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + PICKUP_REMINDER_WINDOW_MINUTES * 60 * 1000);

    const dueOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.CONFIRMED,
        pickupReminderSentAt: null,
        offer: { pickupEnd: { gte: now, lte: windowEnd } },
      },
      include: { offer: true },
    });

    for (const order of dueOrders) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { pickupReminderSentAt: new Date() },
      });
      await this.notifications.createAndNotify(
        order.userId,
        NotificationType.PICKUP_REMINDER,
        "Скоро закрытие самовывоза",
        `У тебя есть около ${PICKUP_REMINDER_WINDOW_MINUTES} минут, чтобы забрать заказ «${order.offer.title}».`,
        { orderId: order.id }
      );
    }
    return dueOrders.length;
  }
}
