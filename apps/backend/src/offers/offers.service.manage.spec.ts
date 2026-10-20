import { BadRequestException, ConflictException } from "@nestjs/common";
import { OfferCategory, OfferStatus, OrderStatus, Role } from "@prisma/client";
import { OffersService } from "./offers.service";
import type { RequestUser } from "../common/interfaces/authenticated-request.interface";

const HOUR = 3_600_000;
const owner = { userId: "owner", role: Role.BUSINESS } as RequestUser;
const stranger = { userId: "other", role: Role.BUSINESS } as RequestUser;

const existing = (over: Record<string, unknown> = {}) => ({
  id: "o", business: { ownerUserId: "owner" }, status: OfferStatus.ACTIVE, category: OfferCategory.FLOWERS, quantityTotal: 10, quantityLeft: 6,
  pickupStart: new Date(Date.now() - HOUR), pickupEnd: new Date(Date.now() + 3 * HOUR), imageUrl: null, ingredients: null, allergens: [],
  allergensDeclared: false, bestBefore: null, baseDiscountPercent: 40, originalPrice: 100000, discountMode: "DYNAMIC", scheduleId: null, occurrenceDate: null, ...over,
});

function setup(offer: Record<string, unknown>, orders: Array<{ status: OrderStatus; _count: { _all: number } }> = [], schedule: Record<string, unknown> | null = null, stockChanged = 1) {
  const tx = {
    offer: { delete: jest.fn().mockResolvedValue({}) },
    offerSchedule: { findUnique: jest.fn().mockResolvedValue(schedule), update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    offer: {
      findUnique: jest.fn().mockResolvedValue(offer),
      update: jest.fn().mockImplementation(async ({ data }: { data: object }) => data),
      updateMany: jest.fn().mockResolvedValue({ count: stockChanged }),
      count: jest.fn().mockResolvedValue(0),
    },
    order: { groupBy: jest.fn().mockResolvedValue(orders) },
    $transaction: jest.fn().mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma, tx, service: new OffersService(prisma as never) };
}

describe("OffersService: правка количества", () => {
  it("добавляет порции к остатку, проданное не трогает", async () => {
    const { service, prisma } = setup(existing());
    await service.update("o", { quantityTotal: 15 } as never, owner);
    expect(prisma.offer.updateMany).toHaveBeenCalledWith({ where: { id: "o", quantityLeft: { gte: 0 } }, data: { quantityTotal: 15, quantityLeft: { increment: 5 } } });
  });

  it("уменьшение защищено условием остатка в БД", async () => {
    const { service, prisma } = setup(existing());
    await service.update("o", { quantityTotal: 7 } as never, owner);
    expect(prisma.offer.updateMany).toHaveBeenCalledWith({ where: { id: "o", quantityLeft: { gte: 3 } }, data: { quantityTotal: 7, quantityLeft: { increment: -3 } } });
  });

  it("меньше проданного нельзя (продано 4 из 10)", async () => {
    const { service, prisma } = setup(existing());
    await expect(service.update("o", { quantityTotal: 3 } as never, owner)).rejects.toThrow(BadRequestException);
    expect(prisma.offer.updateMany).not.toHaveBeenCalled();
  });

  it("гонка с заказом: условие не выполнилось → 409, оффер не меняется", async () => {
    const { service, prisma } = setup(existing(), [], null, 0);
    await expect(service.update("o", { quantityTotal: 5 } as never, owner)).rejects.toThrow(ConflictException);
    expect(prisma.offer.update).not.toHaveBeenCalled();
  });

  it("раскупленный оффер с добавленными порциями снова в продаже", async () => {
    const { service } = setup(existing({ status: OfferStatus.SOLD_OUT, quantityLeft: 0 }));
    expect(await service.update("o", { quantityTotal: 12 } as never, owner)).toMatchObject({ status: OfferStatus.ACTIVE });
  });

  it("убрали все свободные порции — «раскуплен»", async () => {
    const { service } = setup(existing());
    expect(await service.update("o", { quantityTotal: 4 } as never, owner)).toMatchObject({ status: OfferStatus.SOLD_OUT });
  });

  it("чужой оффер править нельзя", async () => {
    const { service } = setup(existing());
    await expect(service.update("o", { quantityTotal: 12 } as never, stranger)).rejects.toThrow();
  });
});

describe("OffersService: ручное удаление", () => {
  it("оффер без заказов удаляется прямо с витрины (ACTIVE)", async () => {
    const { service, tx } = setup(existing());
    expect(await service.remove("o", owner)).toEqual({ success: true, skippedDate: null });
    expect(tx.offer.delete).toHaveBeenCalledWith({ where: { id: "o" } });
  });

  it("есть заказ в работе → 409 и понятная причина, ничего не удалено", async () => {
    const { service, tx } = setup(existing(), [{ status: OrderStatus.CONFIRMED, _count: { _all: 2 } }]);
    await expect(service.remove("o", owner)).rejects.toThrow(/в работе \(2\)/);
    expect(tx.offer.delete).not.toHaveBeenCalled();
  });

  it("есть только история заказов → 409, советуем архив", async () => {
    const { service, tx } = setup(existing(), [{ status: OrderStatus.COMPLETED, _count: { _all: 1 } }]);
    await expect(service.remove("o", owner)).rejects.toThrow(/архив/);
    expect(tx.offer.delete).not.toHaveBeenCalled();
  });

  it("чужой оффер удалить нельзя", async () => {
    const { service, tx } = setup(existing());
    await expect(service.remove("o", stranger)).rejects.toThrow();
    expect(tx.offer.delete).not.toHaveBeenCalled();
  });

  it("авто-оффер на сегодня/будущее: дата уходит в пропуски шаблона, чтобы не выложился снова", async () => {
    const day = new Date(Date.now() + 24 * HOUR).toISOString().slice(0, 10);
    const { service, tx } = setup(existing({ scheduleId: "s", occurrenceDate: day }), [], { id: "s", timezone: "Europe/Moscow", skipDates: ["2000-01-01", "2999-01-01"] });
    expect(await service.remove("o", owner)).toEqual({ success: true, skippedDate: day });
    expect(tx.offerSchedule.update).toHaveBeenCalledWith({ where: { id: "s" }, data: { skipDates: [day, "2999-01-01"].sort() } });
  });

  it("авто-оффер за прошедшую дату: пропуски не трогаем", async () => {
    const { service, tx } = setup(existing({ scheduleId: "s", occurrenceDate: "2000-01-02" }), [], { id: "s", timezone: "Europe/Moscow", skipDates: [] });
    expect(await service.remove("o", owner)).toEqual({ success: true, skippedDate: null });
    expect(tx.offerSchedule.update).not.toHaveBeenCalled();
  });
});
