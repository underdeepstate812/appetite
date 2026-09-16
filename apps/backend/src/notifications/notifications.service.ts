import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import { Paginated } from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PUSH_PROVIDER, PushMessage, PushProvider } from "./push-provider.interface";
import { ListNotificationsQueryDto } from "./dto/list-notifications.query";

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider
  ) {}

  async registerPushToken(userId: string, token: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { expoPushToken: token } });
    return { success: true };
  }

  /** Пишет уведомление в БД и пытается отправить push, если у пользователя есть токен. */
  async createAndNotify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, string>
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, data },
    });
    await this.dispatchPush(userId, { title, body, data });
    return notification;
  }

  /** Только push, без записи в БД — для случаев, когда уведомление уже создано в вызывающей транзакции. */
  async dispatchPush(userId: string, message: PushMessage) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { expoPushToken: true } });
    if (!user?.expoPushToken) return;
    await this.pushProvider.send(user.expoPushToken, message);
  }

  async findMine(userId: string, query: ListNotificationsQueryDto): Promise<Paginated<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = { userId, ...(query.unreadOnly ? { read: false } : {}) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException("Уведомление не найдено");
    if (notification.userId !== userId) throw new ForbiddenException("Это не твоё уведомление");
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }
}
