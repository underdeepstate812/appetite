import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Business, BusinessStatus, OfferCategory, OfferStatus, OrderStatus, Prisma, Role } from "@prisma/client";
import {
  buildSalesSeries,
  normalizeWorkingHours,
  offerWindowHoursProblem,
  salesWindowStart,
  scheduleHoursProblem,
  validateWorkingHours,
  type BusinessSales,
  type BusinessStats,
} from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBusinessDto) {
    const existingOwner = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (existingOwner) {
      throw new ConflictException("Пользователь с таким email уже существует");
    }

    const passwordHash = await bcrypt.hash(dto.ownerPassword, PASSWORD_SALT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          email: dto.ownerEmail,
          passwordHash,
          name: dto.ownerName,
          role: Role.BUSINESS,
        },
      });

      // Снимок текущей глобальной настройки (админ может её менять позже — уже
      // онбордингнутых заведений это задним числом не касается, см. schema.prisma).
      const settings = await tx.platformSettings.findUnique({ where: { id: 1 } });
      const trialPeriodDays = settings?.trialPeriodDays ?? 25;
      const trialEndsAt = new Date(Date.now() + trialPeriodDays * 24 * 60 * 60 * 1000);

      return tx.business.create({
        data: {
          ownerUserId: owner.id,
          name: dto.name,
          description: dto.description,
          category: dto.category,
          address: dto.address,
          lat: dto.lat,
          lng: dto.lng,
          logoUrl: dto.logoUrl,
          trialEndsAt,
          // Ручной онбординг админом (ШАГ 0) — заведение уже провалидировано, сразу ACTIVE.
          status: BusinessStatus.ACTIVE,
        },
      });
    });
  }

  findAll(category?: OfferCategory) {
    return this.prisma.business.findMany({
      where: category ? { category } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  findMine(ownerUserId: string) {
    return this.prisma.business.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException("Заведение не найдено");
    return business;
  }

  async update(id: string, dto: UpdateBusinessDto, requester: RequestUser) {
    const business = await this.findOne(id);
    this.assertOwnerOrAdmin(business.ownerUserId, requester);

    const data = { ...dto };
    if (requester.role !== Role.ADMIN) {
      delete data.status;
      delete data.commissionPercent;
    }

    return this.prisma.business.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.business.delete({ where: { id } });
    return { success: true };
  }

  async getStats(id: string, requester: RequestUser): Promise<BusinessStats> {
    const business = await this.findOne(id);
    this.assertOwnerOrAdmin(business.ownerUserId, requester);

    const [activeOffersCount, ordersByStatus, revenueAgg, ecoAgg, disputedOrders] = await Promise.all([
      this.prisma.offer.count({ where: { businessId: id, status: OfferStatus.ACTIVE } }),
      this.prisma.order.groupBy({ by: ["status"], where: { businessId: id }, _count: { _all: true } }),
      this.prisma.order.aggregate({
        where: { businessId: id, status: OrderStatus.COMPLETED },
        _sum: { totalPrice: true, platformFee: true },
      }),
      // EcoTransaction не хранит businessId напрямую — только связь через Order (ШАГ 5/8).
      this.prisma.ecoTransaction.aggregate({
        where: { order: { businessId: id } },
        _sum: { weightSavedKg: true },
      }),
      this.prisma.order.count({ where: { businessId: id, receiptDisputedAt: { not: null } } }),
    ]);

    const countByStatus = (status: OrderStatus) =>
      ordersByStatus.find((group) => group.status === status)?._count._all ?? 0;

    return {
      activeOffersCount,
      totalOrders: ordersByStatus.reduce((sum, group) => sum + group._count._all, 0),
      confirmedOrders: countByStatus(OrderStatus.CONFIRMED),
      completedOrders: countByStatus(OrderStatus.COMPLETED),
      cancelledOrders: countByStatus(OrderStatus.CANCELLED),
      expiredOrders: countByStatus(OrderStatus.EXPIRED),
      disputedOrders,
      revenue: revenueAgg._sum.totalPrice ?? 0,
      platformFee: revenueAgg._sum.platformFee ?? 0,
      weightSavedKg: ecoAgg._sum.weightSavedKg ?? 0,
    };
  }

  /** Продажи по дням и «когда покупают» — данные графика в кабинете. Считаем в JS по заказам окна: объёмы одного заведения невелики. */
  async getSales(id: string, days: number, requester: RequestUser): Promise<BusinessSales> {
    const business = await this.findOne(id);
    this.assertOwnerOrAdmin(business.ownerUserId, requester);

    const now = Date.now();
    const [orders, first] = await Promise.all([
      this.prisma.order.findMany({
        where: { businessId: id, createdAt: { gte: salesWindowStart(days, now) } },
        select: { createdAt: true, status: true, totalPrice: true, quantity: true, offer: { select: { pickupEnd: true } } },
      }),
      this.prisma.order.aggregate({ where: { businessId: id }, _min: { createdAt: true } }),
    ]);
    return buildSalesSeries(
      orders.map((order) => ({ createdAt: order.createdAt, status: order.status, totalPrice: order.totalPrice, quantity: order.quantity, offerPickupEnd: order.offer.pickupEnd })),
      { days, now, firstOrderAt: first._min.createdAt }
    );
  }

  /**
   * Сохраняет часы работы (null — снять). Уже выложенные офферы и шаблоны не трогаем, но честно сообщаем, сколько из них
   * в новые часы не влезают: активные офферы доживают как есть, а шаблоны перестанут выкладываться, пока их не поправят.
   */
  async setWorkingHours(id: string, workingHours: unknown, requester: RequestUser) {
    const business = await this.findOne(id);
    this.assertOwnerOrAdmin(business.ownerUserId, requester);

    let hours = null;
    if (workingHours !== null && workingHours !== undefined) {
      const problem = validateWorkingHours(workingHours);
      if (problem) throw new BadRequestException(problem);
      hours = normalizeWorkingHours(workingHours);
    }
    const updated = await this.prisma.business.update({ where: { id }, data: { workingHours: hours ? (hours as unknown as Prisma.InputJsonObject) : Prisma.DbNull } });

    const conflicts = { offers: [] as { id: string; title: string; reason: string }[], schedules: [] as { id: string; title: string; reason: string }[] };
    if (hours) {
      const [offers, schedules] = await Promise.all([
        this.prisma.offer.findMany({ where: { businessId: id, status: OfferStatus.ACTIVE, pickupEnd: { gt: new Date() } }, select: { id: true, title: true, pickupStart: true, pickupEnd: true } }),
        this.prisma.offerSchedule.findMany({ where: { businessId: id, isActive: true }, select: { id: true, title: true, daysOfWeek: true, pickupStartTime: true, pickupEndTime: true } }),
      ]);
      for (const offer of offers) {
        const reason = offerWindowHoursProblem(hours, business.timezone, offer.pickupStart.getTime(), offer.pickupEnd.getTime());
        if (reason) conflicts.offers.push({ id: offer.id, title: offer.title, reason });
      }
      for (const schedule of schedules) {
        const reason = scheduleHoursProblem(hours, schedule);
        if (reason) conflicts.schedules.push({ id: schedule.id, title: schedule.title, reason });
      }
    }
    return { business: updated, conflicts };
  }

  private assertOwnerOrAdmin(ownerUserId: string, requester: RequestUser) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.BUSINESS && requester.userId === ownerUserId) return;
    throw new ForbiddenException("Недостаточно прав для этого заведения");
  }
}
