import { randomInt } from "node:crypto";
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OfferStatus, OrderStatus, Prisma, Role } from "@prisma/client";
import { PICKUP_CODE_LENGTH } from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";
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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Резервирование quantityLeft, генерация QR/кода самовывоза "по-настоящему"
   * (с mock-платежом и картинкой QR) и начисление эко-баллов — бизнес-логика ШАГ 5.
   * Здесь — корректный, транзакционно-безопасный CRUD: атомарный резерв остатка
   * и пересчёт денег/pickupCode, без внешних интеграций.
   */
  async create(dto: CreateOrderDto, requester: RequestUser) {
    for (let attempt = 0; attempt < MAX_PICKUP_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.tryCreate(dto, requester);
      } catch (error) {
        const isPickupCodeCollision =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (isPickupCodeCollision && attempt < MAX_PICKUP_CODE_ATTEMPTS - 1) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException("Не удалось создать заказ, попробуй ещё раз");
  }

  private async tryCreate(dto: CreateOrderDto, requester: RequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: dto.offerId }, include: { business: true } });
      if (!offer) throw new NotFoundException("Оффер не найден");
      if (offer.status !== OfferStatus.ACTIVE) {
        throw new ConflictException("Оффер сейчас недоступен для покупки");
      }

      // Атомарная резервация: decrement пройдёт, только если quantityLeft всё ещё достаточен —
      // защищает от гонок при параллельных покупках без отдельной блокировки строки.
      const reserved = await tx.offer.updateMany({
        where: { id: dto.offerId, quantityLeft: { gte: dto.quantity } },
        data: { quantityLeft: { decrement: dto.quantity } },
      });
      if (reserved.count === 0) {
        throw new ConflictException("Недостаточно остатка по этому офферу");
      }

      const totalPrice = offer.discountedPrice * dto.quantity;
      const platformFee = Math.round((totalPrice * offer.business.commissionPercent) / 100);

      return tx.order.create({
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
    });
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

  async cancel(id: string, requester: RequestUser) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Заказ не найден");
    if (order.userId !== requester.userId && requester.role !== Role.ADMIN) {
      throw new ForbiddenException("Это не твой заказ");
    }
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new ConflictException("Заказ уже нельзя отменить");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.offer.update({
        where: { id: order.offerId },
        data: { quantityLeft: { increment: order.quantity } },
      });
      return tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  }

  /** Подтверждение выдачи по pickupCode. Начисление эко-баллов — ШАГ 5. */
  async complete(id: string, dto: CompleteOrderDto, requester: RequestUser) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { business: true } });
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

    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
    });
  }

  private async assertCanAccess(
    order: { userId: string; businessId: string },
    requester: RequestUser
  ) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.USER && order.userId === requester.userId) return;
    if (requester.role === Role.BUSINESS) {
      const business = await this.prisma.business.findUnique({ where: { id: order.businessId } });
      if (business?.ownerUserId === requester.userId) return;
    }
    throw new ForbiddenException("Нет доступа к этому заказу");
  }
}
