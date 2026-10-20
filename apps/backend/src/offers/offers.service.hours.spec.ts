import { BadRequestException } from "@nestjs/common";
import { OfferCategory, OfferStatus, Role } from "@prisma/client";
import { defaultWorkingHours, zonedTimeToUtc } from "@apetite/shared";
import { OffersService } from "./offers.service";
import type { RequestUser } from "../common/interfaces/authenticated-request.interface";

const owner = { userId: "owner", role: Role.BUSINESS } as RequestUser;
// Пн–сб 10:00–22:00, воскресенье выходной; «сегодня» подставляем как ближайший понедельник в будущем
const hours = { ...defaultWorkingHours(), "7": null };
const msk = (date: string, time: string) => zonedTimeToUtc(date, time, "Europe/Moscow");
const MON = "2026-10-19"; // понедельник
beforeAll(() => jest.useFakeTimers({ now: msk(MON, "10:00"), doNotFake: ["nextTick", "setImmediate", "setTimeout", "setInterval", "clearTimeout", "clearInterval"] }));
afterAll(() => jest.useRealTimers());
const business = { id: "b", ownerUserId: "owner", workingHours: hours, timezone: "Europe/Moscow" };

const dto = (startTime: string, endTime: string, over: Record<string, unknown> = {}) => ({
  businessId: "b", title: "Набор", category: OfferCategory.FLOWERS, originalPriceRub: 500, weightKg: 1, quantityTotal: 3, baseDiscountPercent: 40,
  pickupStart: msk(MON, startTime).toISOString(), pickupEnd: msk(MON, endTime).toISOString(), ...over,
});

function setup(existing?: Record<string, unknown>, biz: Record<string, unknown> = business) {
  const prisma = {
    business: { findUnique: jest.fn().mockResolvedValue(biz) },
    offer: { create: jest.fn().mockImplementation(async ({ data }: { data: object }) => data), findUnique: jest.fn().mockResolvedValue(existing), update: jest.fn().mockImplementation(async ({ data }: { data: object }) => data), count: jest.fn().mockResolvedValue(0) },
  };
  return { prisma, service: new OffersService(prisma as never) };
}

describe("OffersService: часы работы заведения", () => {
  it("окно внутри часов — оффер создаётся", async () => {
    const { service, prisma } = setup();
    await service.create(dto("17:00", "21:00") as never, owner);
    expect(prisma.offer.create).toHaveBeenCalled();
  });
  it("конец после закрытия — 400 с временем закрытия, оффер не создан", async () => {
    const { service, prisma } = setup();
    await expect(service.create(dto("19:00", "23:30") as never, owner)).rejects.toThrow(/закрывается в 22:00/);
    expect(prisma.offer.create).not.toHaveBeenCalled();
  });
  it("начало до открытия — 400", async () => {
    const { service } = setup();
    await expect(service.create(dto("08:00", "11:00") as never, owner)).rejects.toThrow(/открывается в 10:00/);
  });
  it("часы не заданы — прежние общие правила (не ограничиваем закрытием)", async () => {
    const { service, prisma } = setup(undefined, { ...business, workingHours: null });
    await service.create(dto("19:00", "23:30") as never, owner);
    expect(prisma.offer.create).toHaveBeenCalled();
  });

  describe("правка", () => {
    const existing = {
      id: "o", business, status: OfferStatus.ACTIVE, category: OfferCategory.FLOWERS, quantityTotal: 3, quantityLeft: 3, imageUrl: null, ingredients: null, allergens: [], allergensDeclared: false,
      bestBefore: null, baseDiscountPercent: 40, originalPrice: 50000, discountMode: "DYNAMIC", pickupStart: msk(MON, "19:00"), pickupEnd: msk(MON, "23:30"),
    };
    it("окно не менялось (старый оффер за часами) — название править можно", async () => {
      const { service } = setup(existing);
      await expect(service.update("o", { title: "Новое", pickupStart: existing.pickupStart.toISOString(), pickupEnd: existing.pickupEnd.toISOString() } as never, owner)).resolves.toBeDefined();
    });
    it("перенос конца за закрытие — 400", async () => {
      const { service } = setup({ ...existing, pickupEnd: msk(MON, "21:00") });
      await expect(service.update("o", { pickupEnd: msk(MON, "23:00").toISOString() } as never, owner)).rejects.toThrow(BadRequestException);
    });
    it("перенос внутрь часов проходит", async () => {
      const { service } = setup(existing);
      await expect(service.update("o", { pickupEnd: msk(MON, "21:30").toISOString() } as never, owner)).resolves.toBeDefined();
    });
  });
});
