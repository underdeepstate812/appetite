import { randomInt } from "node:crypto";
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as QRCode from "qrcode";
import { Business, NotificationType, Offer, OfferStatus, OrderStatus, PaymentStatus, Prisma, Role } from "@prisma/client";
import { ECO_POINTS_PER_KG, PICKUP_CODE_LENGTH } from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { CompleteOrderDto } from "./dto/complete-order.dto";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

const MAX_PICKUP_CODE_ATTEMPTS = 5;

function generatePickupCode(): string {
  const max = 10 ** PICKUP_CODE_LENGTH;
  return randomInt(0, max).toString().padStart(PICKUP_CODE_LENGTH, "0");
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * Полный сценарий покупки: атомарная резервация остатка → mock-оплата (вне
   * транзакции — так и должно быть с реальным платёжным провайдером, это сетевой
   * вызов) → запись заказа + платежа. Если оплата не прошла, остаток возвращается.
   */
  async create(dto: CreateOrderDto, requester: RequestUser) {
    const { offer, business } = await this.reserveStock(dto.offerId, dto.quantity);

    const totalPrice = offer.discountedPrice * dto.quantity;
    // Бесплатное подключение на старте (бизнес-модель, оферта на сайте): пока не истёк
    // пробный период (снимок в trialEndsAt на момент онбординга), комиссия не взимается
    // независимо от commissionPercent — он продолжает действовать как ставка НА БУДУЩЕЕ.
    const inTrial = business.trialEndsAt !== null && business.trialEndsAt > new Date();
    const platformFee = inTrial ? 0 : Math.round((totalPrice * business.commissionPercent) / 100);

    let charge;
    try {
      charge = await this.payments.charge({ amount: totalPrice, currency: "RUB" });
      if (charge.status !== PaymentStatus.SUCCEEDED) {
        throw new ConflictException("Оплата не прошла, попробуй ещё раз");
      }
    } catch (error) {
      await this.releaseStock(dto.offerId, dto.quantity);
      throw error;
    }

    for (let attempt = 0; attempt < MAX_PICKUP_CODE_ATTEMPTS; attempt++) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              userId: requester.userId,
              offerId: offer.id,
              businessId: offer.businessId,
              quantity: dto.quantity,
              totalPrice,
              platformFee,
              status: OrderStatus.CONFIRMED,
              pickupCode: generatePickupCode(),
            },
          });
          await tx.payment.create({
            data: {
              orderId: order.id,
              provider: this.payments.providerName,
              externalId: charge.externalId,
              amount: totalPrice,
              currency: "RUB",
              status: charge.status,
            },
          });
          const title = "Новый заказ";
          const body = `${offer.title} × ${dto.quantity} на ${(totalPrice / 100).toFixed(0)} ₽ — подтверди в панели, чтобы начать готовить.`;
          await tx.notification.create({
            data: {
              userId: business.ownerUserId,
              type: NotificationType.ORDER_RECEIVED,
              title,
              body,
              data: { orderId: order.id },
            },
          });
          const qrCodeDataUrl = await this.generateQrCode(order.id, order.pickupCode);
          return { order, qrCodeDataUrl, notifyBusiness: { title, body } };
        });

        // Push — best-effort сетевой вызов, вне транзакции (та же логика, что и с оплатой выше).
        await this.notifications.dispatchPush(business.ownerUserId, {
          title: result.notifyBusiness.title,
          body: result.notifyBusiness.body,
          data: { orderId: result.order.id },
        });
        return { ...result.order, qrCodeDataUrl: result.qrCodeDataUrl };
      } catch (error) {
        const isPickupCodeCollision =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (isPickupCodeCollision && attempt < MAX_PICKUP_CODE_ATTEMPTS - 1) {
          continue; // коллизия pickupCode — платёж уже проведён, пересоздаём только заказ с новым кодом
        }
        await this.releaseStock(dto.offerId, dto.quantity);
        throw error;
      }
    }
    // Недостижимо (цикл либо возвращает результат, либо бросает исключение выше),
    // но нужно TypeScript-у для полноты возвращаемого типа.
    throw new ConflictException("Не удалось создать заказ, попробуй ещё раз");
  }

  async findAll(requester: RequestUser) {
    if (requester.role === Role.ADMIN) {
      return this.prisma.order.findMany({ orderBy: { createdAt: "desc" } });
    }
    if (requester.role === Role.BUSINESS) {
      const businesses = await this.prisma.business.findMany({
        where: { ownerUserId: requester.userId },
        select: { id: true },
      });
      return this.prisma.order.findMany({
        where: { businessId: { in: businesses.map((b) => b.id) } },
        orderBy: { createdAt: "desc" },
      });
    }
    return this.prisma.order.findMany({
      where: { userId: requester.userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, requester: RequestUser) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Заказ не найден");
    await this.assertCanAccess(order, requester);
    return order;
  }

  /** QR кодирует {orderId, pickupCode} — Admin-панель (ШАГ 10) сможет сканировать вместо ручного ввода кода. */
  async getQrCode(id: string, requester: RequestUser) {
    const order = await this.findOne(id, requester);
    const qrCodeDataUrl = await this.generateQrCode(order.id, order.pickupCode);
    return { qrCodeDataUrl };
  }

  /**
   * Оплаченный заказ отменить покупатель уже не может в принципе — только поддержка
   * (ADMIN), как исключение (ошибочный заказ, фрод и т.п.). Раньше тут было окно до
   * подтверждения заведением, но по бизнес-правилу оплата — финальная точка: отменить
   * нельзя, даже если заведение ещё не видело заказ.
   */
  async cancel(id: string, requester: RequestUser) {
    if (requester.role !== Role.ADMIN) {
      throw new ForbiddenException("Отменить оплаченный заказ может только поддержка");
    }
    const order = await this.prisma.order.findUnique({ where: { id }, include: { business: true, offer: true } });
    if (!order) throw new NotFoundException("Заказ не найден");
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new ConflictException("Заказ уже нельзя отменить");
    }

    const businessTitle = "Заказ отменён";
    const businessBody = `Заказ «${order.offer.title}» отменён поддержкой.`;
    const buyerTitle = "Заказ отменён";
    const buyerBody = `Твой заказ «${order.offer.title}» отменён поддержкой — деньги будут возвращены.`;
    const cancelled = await this.prisma.$transaction(async (tx) => {
      // Условие в WHERE — не оптимизация, а атомарная защита от гонки с complete(): если
      // заведение успело выдать заказ ровно между проверкой выше и этим апдейтом, affected
      // будет 0 (тот же приём, что в reserveStock() для quantityLeft).
      const result = await tx.order.updateMany({
        where: { id, status: OrderStatus.CONFIRMED },
        data: { status: OrderStatus.CANCELLED },
      });
      if (result.count === 0) {
        throw new ConflictException("Заказ уже нельзя отменить");
      }
      await tx.offer.update({
        where: { id: order.offerId },
        data: { quantityLeft: { increment: order.quantity } },
      });
      await tx.notification.create({
        data: {
          userId: order.business.ownerUserId,
          type: NotificationType.ORDER_CANCELLED,
          title: businessTitle,
          body: businessBody,
          data: { orderId: order.id },
        },
      });
      await tx.notification.create({
        data: {
          userId: order.userId,
          type: NotificationType.ORDER_CANCELLED,
          title: buyerTitle,
          body: buyerBody,
          data: { orderId: order.id },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id } });
    });
    await this.reactivateIfSoldOut(order.offerId);
    await this.notifications.dispatchPush(order.business.ownerUserId, { title: businessTitle, body: businessBody, data: { orderId: order.id } });
    await this.notifications.dispatchPush(order.userId, { title: buyerTitle, body: buyerBody, data: { orderId: order.id } });
    return cancelled;
  }

  /**
   * Заведение видит новый заказ в уведомлении (ORDER_RECEIVED) и подтверждает его здесь —
   * до этого момента покупатель ещё может отменить (см. cancel()), после — уже нет.
   */
  async accept(id: string, requester: RequestUser) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { business: true, offer: true } });
    if (!order) throw new NotFoundException("Заказ не найден");
    if (requester.role === Role.USER) {
      throw new ForbiddenException("Принять заказ может только заведение или админ");
    }
    if (requester.role === Role.BUSINESS && order.business.ownerUserId !== requester.userId) {
      throw new ForbiddenException("Это не заказ твоего заведения");
    }
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new ConflictException("Заказ уже не ожидает подтверждения");
    }
    if (order.acceptedAt) {
      throw new ConflictException("Заказ уже принят");
    }

    const title = "Заказ приняли";
    const body = `«${order.offer.title}» уже готовят — отменить заказ теперь нельзя.`;
    const updated = await this.prisma.$transaction(async (tx) => {
      // Та же атомарная защита, что и в cancel(): если покупатель успел отменить заказ ровно
      // между проверкой выше и этим апдейтом, affected будет 0 — без этого условия заказ мог
      // бы получить acceptedAt уже будучи CANCELLED (и уведомление "теперь не отменить" ушло
      // бы покупателю, который его только что отменил).
      const result = await tx.order.updateMany({
        where: { id, status: OrderStatus.CONFIRMED, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (result.count === 0) {
        throw new ConflictException("Заказ уже нельзя принять — его статус изменился");
      }
      await tx.notification.create({
        data: {
          userId: order.userId,
          type: NotificationType.ORDER_ACCEPTED,
          title,
          body,
          data: { orderId: order.id },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id } });
    });
    await this.notifications.dispatchPush(order.userId, { title, body, data: { orderId: order.id } });
    return updated;
  }

  /** Подтверждение выдачи по pickupCode: статус → COMPLETED, начисление эко-баллов, уведомление. */
  async complete(id: string, dto: CompleteOrderDto, requester: RequestUser) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { business: true, offer: true } });
    if (!order) throw new NotFoundException("Заказ не найден");
    if (requester.role === Role.USER) {
      throw new ForbiddenException("Подтвердить выдачу может только заведение или админ");
    }
    if (requester.role === Role.BUSINESS && order.business.ownerUserId !== requester.userId) {
      throw new ForbiddenException("Это не заказ твоего заведения");
    }
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new ConflictException("Заказ не ожидает самовывоза");
    }
    if (order.pickupCode !== dto.pickupCode) {
      throw new ConflictException("Неверный код самовывоза");
    }

    const weightSavedKg = order.offer.weightKg * order.quantity;
    const points = Math.round(weightSavedKg * ECO_POINTS_PER_KG);
    const title = "Заказ забран";
    const body = `Спасибо! Ты спас(-ла) ${weightSavedKg.toFixed(1)} кг еды от выброса — +${points} эко-баллов.`;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Та же защита от гонки, что в cancel()/accept(): если покупатель успел отменить заказ
      // ровно между проверкой выше и этим апдейтом, affected будет 0 — без неё можно было бы
      // выдать (и начислить эко-баллы за) уже отменённый заказ, чей остаток уже вернулся в офер.
      const result = await tx.order.updateMany({
        where: { id, status: OrderStatus.CONFIRMED },
        data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
      });
      if (result.count === 0) {
        throw new ConflictException("Заказ не ожидает самовывоза");
      }
      await tx.ecoTransaction.create({
        data: { userId: order.userId, orderId: order.id, points, weightSavedKg },
      });
      await tx.notification.create({
        data: {
          userId: order.userId,
          type: NotificationType.ORDER_COMPLETED,
          title,
          body,
          data: { orderId: order.id },
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id } });
    });

    // Push — best-effort сетевой вызов, вне транзакции (та же логика, что и с оплатой в ШАГ 5).
    await this.notifications.dispatchPush(order.userId, { title, body, data: { orderId: order.id } });
    return updated;
  }

  /** Атомарная резервация: decrement проходит, только если quantityLeft всё ещё достаточен. */
  private async reserveStock(
    offerId: string,
    quantity: number
  ): Promise<{ offer: Offer; business: Business }> {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId }, include: { business: true } });
      if (!offer) throw new NotFoundException("Оффер не найден");
      if (offer.status !== OfferStatus.ACTIVE) {
        throw new ConflictException("Оффер сейчас недоступен для покупки");
      }

      const reserved = await tx.offer.updateMany({
        where: { id: offerId, quantityLeft: { gte: quantity } },
        data: { quantityLeft: { decrement: quantity } },
      });
      if (reserved.count === 0) {
        throw new ConflictException("Недостаточно остатка по этому офферу");
      }

      const remaining = offer.quantityLeft - quantity;
      if (remaining === 0) {
        await tx.offer.update({ where: { id: offerId }, data: { status: OfferStatus.SOLD_OUT } });
      }

      const { business, ...offerFields } = offer;
      return { offer: offerFields, business };
    });
  }

  /** Откат резервации при неудачной оплате/создании заказа (в mock-режиме практически недостижимо). */
  private async releaseStock(offerId: string, quantity: number) {
    await this.prisma.offer.update({
      where: { id: offerId },
      data: { quantityLeft: { increment: quantity } },
    });
    await this.reactivateIfSoldOut(offerId);
  }

  private async reactivateIfSoldOut(offerId: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (offer && offer.status === OfferStatus.SOLD_OUT && offer.quantityLeft > 0) {
      await this.prisma.offer.update({ where: { id: offerId }, data: { status: OfferStatus.ACTIVE } });
    }
  }

  private async generateQrCode(orderId: string, pickupCode: string): Promise<string> {
    return QRCode.toDataURL(JSON.stringify({ orderId, pickupCode }));
  }

  private async assertCanAccess(order: { userId: string; businessId: string }, requester: RequestUser) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.USER && order.userId === requester.userId) return;
    if (requester.role === Role.BUSINESS) {
      const business = await this.prisma.business.findUnique({ where: { id: order.businessId } });
      if (business?.ownerUserId === requester.userId) return;
    }
    throw new ForbiddenException("Нет доступа к этому заказу");
  }
}
