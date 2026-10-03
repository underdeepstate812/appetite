import { Injectable } from "@nestjs/common";
import { BusinessStatus, OfferStatus, OrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Возвращаемые формы структурно совпадают с PlatformBusinessSummary/PlatformStats
// из @apetite/shared (эти типы существуют для фронтенда) — не аннотируем ими явно
// здесь, т.к. номинальные enum'ы Prisma (@prisma/client) и shared — разные типы
// при одинаковых строковых значениях; то же соглашение, что и в остальных сервисах
// (businesses.service.ts и др. возвращают Prisma-типы без явных shared-аннотаций).
const DEFAULT_TRIAL_PERIOD_DAYS = 25;

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  /** Синглтон-строка (id=1) — читаем-или-создаём с дефолтом, отдельного сида не требует. */
  async getSettings() {
    const existing = await this.prisma.platformSettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return this.prisma.platformSettings.create({
      data: { id: 1, trialPeriodDays: DEFAULT_TRIAL_PERIOD_DAYS },
    });
  }

  async updateSettings(trialPeriodDays: number) {
    return this.prisma.platformSettings.upsert({
      where: { id: 1 },
      create: { id: 1, trialPeriodDays },
      update: { trialPeriodDays },
    });
  }

  async listBusinesses() {
    const [businesses, orderAgg] = await Promise.all([
      this.prisma.business.findMany({ orderBy: { createdAt: "desc" } }),
      this.prisma.order.groupBy({
        by: ["businessId"],
        where: { status: OrderStatus.COMPLETED },
        _sum: { totalPrice: true, platformFee: true },
        _count: { _all: true },
      }),
    ]);

    const aggByBusiness = new Map(orderAgg.map((group) => [group.businessId, group]));

    return businesses.map((business) => {
      const agg = aggByBusiness.get(business.id);
      return {
        id: business.id,
        name: business.name,
        category: business.category,
        status: business.status,
        commissionPercent: business.commissionPercent,
        address: business.address,
        ordersCompleted: agg?._count._all ?? 0,
        revenue: agg?._sum.totalPrice ?? 0,
        platformFee: agg?._sum.platformFee ?? 0,
        trialEndsAt: business.trialEndsAt?.toISOString() ?? null,
        createdAt: business.createdAt.toISOString(),
      };
    });
  }

  async getStats() {
    const [businessesByStatus, activeOffersCount, ordersByStatus, revenueAgg, ecoAgg] = await Promise.all([
      this.prisma.business.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.offer.count({ where: { status: OfferStatus.ACTIVE } }),
      this.prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.COMPLETED },
        _sum: { totalPrice: true, platformFee: true },
      }),
      this.prisma.ecoTransaction.aggregate({ _sum: { weightSavedKg: true } }),
    ]);

    const countBusinesses = (status: BusinessStatus) =>
      businessesByStatus.find((group) => group.status === status)?._count._all ?? 0;
    const countOrders = (status: OrderStatus) =>
      ordersByStatus.find((group) => group.status === status)?._count._all ?? 0;

    return {
      businessesTotal: businessesByStatus.reduce((sum, group) => sum + group._count._all, 0),
      businessesActive: countBusinesses(BusinessStatus.ACTIVE),
      businessesSuspended: countBusinesses(BusinessStatus.SUSPENDED),
      businessesPending: countBusinesses(BusinessStatus.PENDING),
      activeOffersCount,
      totalOrders: ordersByStatus.reduce((sum, group) => sum + group._count._all, 0),
      confirmedOrders: countOrders(OrderStatus.CONFIRMED),
      completedOrders: countOrders(OrderStatus.COMPLETED),
      cancelledOrders: countOrders(OrderStatus.CANCELLED),
      expiredOrders: countOrders(OrderStatus.EXPIRED),
      gmv: revenueAgg._sum.totalPrice ?? 0,
      platformRevenue: revenueAgg._sum.platformFee ?? 0,
      weightSavedKg: ecoAgg._sum.weightSavedKg ?? 0,
    };
  }
}
