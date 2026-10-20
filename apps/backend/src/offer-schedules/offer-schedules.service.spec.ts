import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BusinessStatus, DiscountMode, OfferCategory, OfferStatus, Prisma, Role } from "@prisma/client";
import { defaultWorkingHours, zonedTimeToUtc } from "@apetite/shared";
import { OfferSchedulesService } from "./offer-schedules.service";
import type { CreateOfferScheduleDto } from "./dto/offer-schedule.dto";
import type { RequestUser } from "../common/interfaces/authenticated-request.interface";

const msk = (date: string, time: string) => zonedTimeToUtc(date, time, "Europe/Moscow").getTime();
const owner: RequestUser = { userId: "owner-1", role: Role.BUSINESS } as RequestUser;
const stranger: RequestUser = { userId: "other", role: Role.BUSINESS } as RequestUser;
const admin: RequestUser = { userId: "admin", role: Role.ADMIN } as RequestUser;

const business = { id: "11111111-1111-4111-8111-111111111111", ownerUserId: "owner-1", status: BusinessStatus.ACTIVE, workingHours: null as unknown, timezone: "Europe/Moscow" };

function createPrismaMock() {
  return {
    business: { findUnique: jest.fn() },
    offerSchedule: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    offer: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn().mockResolvedValue({}) },
  };
}

const baseDto = (over: Partial<CreateOfferScheduleDto> = {}): CreateOfferScheduleDto =>
  ({
    businessId: business.id,
    title: "Круассан и кофе",
    category: OfferCategory.BAKERY,
    originalPriceRub: 300,
    baseDiscountPercent: 50,
    weightKg: 0.3,
    quantityTotal: 5,
    ingredients: "Мука, масло, молоко",
    allergens: ["gluten", "milk"],
    bestBeforeHoursAfterEnd: 6,
    daysOfWeek: [1, 2, 3, 4, 5],
    pickupStartTime: "07:00",
    pickupEndTime: "10:00",
    ...over,
  }) as CreateOfferScheduleDto;

const storedSchedule = (over: Record<string, unknown> = {}) => ({
  id: "sched-1",
  businessId: business.id,
  title: "Круассан и кофе",
  description: null,
  category: OfferCategory.BAKERY,
  originalPrice: 30000,
  baseDiscountPercent: 50,
  discountMode: DiscountMode.DYNAMIC,
  imageUrl: null,
  quantityTotal: 5,
  weightKg: 0.3,
  ingredients: "Мука, масло, молоко",
  allergens: ["gluten", "milk"],
  allergensDeclared: true,
  bestBeforeHoursAfterEnd: 6,
  daysOfWeek: [1, 2, 3, 4, 5],
  pickupStartTime: "07:00",
  pickupEndTime: "10:00",
  publishLeadMinutes: 180,
  timezone: "Europe/Moscow",
  startsOn: null,
  endsOn: null,
  skipDates: [] as string[],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  business,
  ...over,
});

describe("OfferSchedulesService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: OfferSchedulesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new OfferSchedulesService(prisma as never);
    prisma.business.findUnique.mockResolvedValue(business);
    prisma.offerSchedule.count.mockResolvedValue(0);
    prisma.offerSchedule.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "sched-1", ...data }));
  });

  describe("create", () => {
    it("stores the position in kopecks with defaults: dynamic discount, Moscow time, 3 h lead", async () => {
      const created = await service.create(baseDto(), owner);
      expect(created).toMatchObject({ originalPrice: 30000, discountMode: DiscountMode.DYNAMIC, timezone: "Europe/Moscow", publishLeadMinutes: 180, isActive: true, skipDates: [] });
      expect(created.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
    });

    it("keeps a fixed discount when asked", async () => {
      expect(await service.create(baseDto({ discountMode: DiscountMode.FIXED }), owner)).toMatchObject({ discountMode: DiscountMode.FIXED });
    });

    it("lets only the owner or an admin create", async () => {
      await expect(service.create(baseDto(), stranger)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.create(baseDto(), admin)).resolves.toBeDefined();
    });

    it("404 for an unknown business", async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.create(baseDto(), owner)).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      [{ daysOfWeek: [] }, /хотя бы один день/],
      [{ daysOfWeek: [1, 1] }, /без повторов/],
      [{ pickupStartTime: "09:55", pickupEndTime: "10:00" }, /не короче/],
      [{ timezone: "Mars/Olympus" }, /часовой пояс/],
      [{ startsOn: "2026-10-10", endsOn: "2026-10-01" }, /раньше/],
    ])("rejects a bad schedule %j", async (patch, message) => {
      await expect(service.create(baseDto(patch as Partial<CreateOfferScheduleDto>), owner)).rejects.toThrow(message);
    });

    it("food needs ingredients, allergens and a shelf life — the same as a manual offer", async () => {
      await expect(service.create(baseDto({ ingredients: undefined }), owner)).rejects.toThrow(/состав/i);
      await expect(service.create(baseDto({ allergens: undefined }), owner)).rejects.toThrow(/аллерген/i);
      await expect(service.create(baseDto({ bestBeforeHoursAfterEnd: undefined }), owner)).rejects.toThrow(/срок годности/i);
      // цветам состав не нужен
      await expect(service.create(baseDto({ category: OfferCategory.FLOWERS, ingredients: undefined, allergens: undefined, bestBeforeHoursAfterEnd: undefined }), owner)).resolves.toBeDefined();
    });

    it("caps the number of templates per business", async () => {
      prisma.offerSchedule.count.mockResolvedValue(20);
      await expect(service.create(baseDto(), owner)).rejects.toThrow(/Не больше 20/);
    });

    it("links the offer created by hand to the first occurrence so no duplicate appears that day", async () => {
      // 19.10.2026 — понедельник; ручной оффер стартует в 07:00 МСК
      prisma.offer.findUnique.mockResolvedValue({ id: "offer-1", businessId: business.id, scheduleId: null, pickupStart: new Date(msk("2026-10-19", "07:00")) });
      await service.create(baseDto({ linkOfferId: "22222222-2222-4222-8222-222222222222" }), owner);
      expect(prisma.offer.update).toHaveBeenCalledWith({ where: { id: "offer-1" }, data: { scheduleId: "sched-1", occurrenceDate: "2026-10-19" } });
    });

    it("does not link an offer from another day of week, another business or an already linked one", async () => {
      const link = "22222222-2222-4222-8222-222222222222";
      prisma.offer.findUnique.mockResolvedValue({ id: "o", businessId: business.id, scheduleId: null, pickupStart: new Date(msk("2026-10-24", "07:00")) }); // суббота
      await service.create(baseDto({ linkOfferId: link }), owner);
      prisma.offer.findUnique.mockResolvedValue({ id: "o", businessId: "another", scheduleId: null, pickupStart: new Date(msk("2026-10-19", "07:00")) });
      await service.create(baseDto({ linkOfferId: link }), owner);
      prisma.offer.findUnique.mockResolvedValue({ id: "o", businessId: business.id, scheduleId: "x", pickupStart: new Date(msk("2026-10-19", "07:00")) });
      await service.create(baseDto({ linkOfferId: link }), owner);
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    beforeEach(() => {
      prisma.offerSchedule.findUnique.mockResolvedValue(storedSchedule());
      prisma.offerSchedule.update.mockImplementation(async ({ data }: { data: object }) => ({ id: "sched-1", ...data }));
    });

    it("changes only future occurrences: recalculates the stored price, touches no offers", async () => {
      const updated = await service.update("sched-1", { originalPriceRub: 350, daysOfWeek: [6, 7] }, owner);
      expect(updated).toMatchObject({ originalPrice: 35000, daysOfWeek: [6, 7] });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it("validates the merged schedule, not just the patch", async () => {
      await expect(service.update("sched-1", { pickupStartTime: "09:55" }, owner)).rejects.toThrow(/не короче/); // конец прежний 10:00
    });

    it("lets one lift a boundary with null and rejects someone else's template", async () => {
      prisma.offerSchedule.findUnique.mockResolvedValue(storedSchedule({ endsOn: "2026-12-31" }));
      expect(await service.update("sched-1", { endsOn: null }, owner)).toMatchObject({ endsOn: null });
      await expect(service.update("sched-1", { isActive: false }, stranger)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("can pause and resume", async () => {
      expect(await service.update("sched-1", { isActive: false }, owner)).toMatchObject({ isActive: false });
    });
  });

  describe("skip / unskip", () => {
    beforeEach(() => {
      prisma.offerSchedule.findUnique.mockResolvedValue(storedSchedule());
      prisma.offerSchedule.update.mockImplementation(async ({ data }: { data: object }) => ({ id: "sched-1", ...data }));
      jest.useFakeTimers().setSystemTime(msk("2026-10-19", "06:00"));
    });
    afterEach(() => jest.useRealTimers());

    it("adds a future date once and keeps the list sorted", async () => {
      const first = await service.skip("sched-1", "2026-10-22", owner);
      expect(first.schedule.skipDates).toEqual(["2026-10-22"]);
      prisma.offerSchedule.findUnique.mockResolvedValue(storedSchedule({ skipDates: ["2026-10-22"] }));
      const second = await service.skip("sched-1", "2026-10-20", owner);
      expect(second.schedule.skipDates).toEqual(["2026-10-20", "2026-10-22"]);
      const again = await service.skip("sched-1", "2026-10-22", owner);
      expect(again.schedule.skipDates).toEqual(["2026-10-22"]);
    });

    it("rejects a past or malformed date", async () => {
      await expect(service.skip("sched-1", "2026-10-18", owner)).rejects.toThrow(/прошедшую/);
      await expect(service.skip("sched-1", "2026-02-30", owner)).rejects.toThrow(/ГГГГ-ММ-ДД/);
    });

    it("archives today's already published offer when nobody ordered it", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer-1", status: OfferStatus.ACTIVE, quantityLeft: 5, quantityTotal: 5 });
      const result = await service.skip("sched-1", "2026-10-19", owner);
      expect(prisma.offer.update).toHaveBeenCalledWith({ where: { id: "offer-1" }, data: { status: OfferStatus.ARCHIVED } });
      expect(result).toMatchObject({ archivedOfferId: "offer-1", keptBecauseOrders: false });
    });

    it("leaves a published offer alone once something was ordered — paid orders are not taken back", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "offer-1", status: OfferStatus.ACTIVE, quantityLeft: 3, quantityTotal: 5 });
      const result = await service.skip("sched-1", "2026-10-19", owner);
      expect(prisma.offer.update).not.toHaveBeenCalled();
      expect(result).toMatchObject({ archivedOfferId: null, keptBecauseOrders: true });
    });

    it("unskip returns the date", async () => {
      prisma.offerSchedule.findUnique.mockResolvedValue(storedSchedule({ skipDates: ["2026-10-20", "2026-10-22"] }));
      expect((await service.unskip("sched-1", "2026-10-20", owner)).skipDates).toEqual(["2026-10-22"]);
    });
  });

  describe("remove", () => {
    it("deletes only the template (published offers stay thanks to SET NULL)", async () => {
      prisma.offerSchedule.findUnique.mockResolvedValue(storedSchedule());
      await expect(service.remove("sched-1", owner)).resolves.toEqual({ success: true });
      expect(prisma.offerSchedule.delete).toHaveBeenCalledWith({ where: { id: "sched-1" } });
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });
  });

  describe("часы работы заведения", () => {
    const hours = { ...defaultWorkingHours(), "6": null, "7": null }; // пн–пт 10:00–22:00, сб/вс выходные
    const withHours = { ...business, workingHours: hours };

    it("шаблон, не влезающий в часы работы, не создаётся: причина названа", async () => {
      prisma.business.findUnique.mockResolvedValue(withHours);
      prisma.offerSchedule.count.mockResolvedValue(0);
      await expect(service.create(baseDto({ pickupStartTime: "07:00", pickupEndTime: "10:00" }), owner)).rejects.toThrow(/открывается в 10:00/);
      await expect(service.create(baseDto({ daysOfWeek: [1, 6], pickupStartTime: "17:00", pickupEndTime: "21:00" }), owner)).rejects.toThrow(/в субботу не работает/);
      await expect(service.create(baseDto({ pickupStartTime: "20:00", pickupEndTime: "23:00" }), owner)).rejects.toThrow(/закрывается в 22:00/);
      expect(prisma.offerSchedule.create).not.toHaveBeenCalled();
    });

    it("выкладка, которая перестала влезать после смены часов, не создаётся и считается", async () => {
      prisma.offerSchedule.findMany.mockResolvedValue([storedSchedule({ business: withHours })]);
      prisma.offer.findUnique.mockResolvedValue(null);
      const result = await service.materialize(msk("2026-10-19", "04:00")); // шаблон 07:00–10:00, а заведение открывается в 10:00
      expect(result).toEqual({ created: 0, checked: 1, skippedOutsideHours: 1 });
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });
  });

  describe("materialize", () => {
    beforeEach(() => {
      prisma.offerSchedule.findMany.mockResolvedValue([storedSchedule()]);
      prisma.offer.findUnique.mockResolvedValue(null);
      prisma.offer.create.mockResolvedValue({});
    });

    it("publishes today's offer once its time has come, with a full copy of the template", async () => {
      const result = await service.materialize(msk("2026-10-19", "04:00")); // 07:00 − 3 ч = 04:00, понедельник
      expect(result).toEqual({ created: 1, checked: 1, skippedOutsideHours: 0 });
      const data = prisma.offer.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        businessId: business.id,
        scheduleId: "sched-1",
        occurrenceDate: "2026-10-19",
        title: "Круассан и кофе",
        originalPrice: 30000,
        quantityTotal: 5,
        quantityLeft: 5,
        status: OfferStatus.ACTIVE,
        discountMode: DiscountMode.DYNAMIC,
        allergens: ["gluten", "milk"],
      });
      expect(data.pickupStart.toISOString()).toBe("2026-10-19T04:00:00.000Z");
      expect(data.pickupEnd.toISOString()).toBe("2026-10-19T07:00:00.000Z");
      expect(data.bestBefore.toISOString()).toBe("2026-10-19T13:00:00.000Z"); // конец + 6 ч
    });

    it("does not publish before its time", async () => {
      expect((await service.materialize(msk("2026-10-19", "03:59"))).created).toBe(0);
    });

    it("is idempotent: an offer for that date already exists → nothing created", async () => {
      prisma.offer.findUnique.mockResolvedValue({ id: "exists" });
      expect((await service.materialize(msk("2026-10-19", "05:00"))).created).toBe(0);
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it("survives a parallel instance winning the race (unique violation)", async () => {
      prisma.offer.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }));
      expect((await service.materialize(msk("2026-10-19", "05:00"))).created).toBe(0);
    });

    it("rethrows anything that is not a duplicate", async () => {
      prisma.offer.create.mockRejectedValue(new Error("db down"));
      await expect(service.materialize(msk("2026-10-19", "05:00"))).rejects.toThrow("db down");
    });

    it("a fixed-discount template publishes at exactly its discount even when the window is about to close", async () => {
      prisma.offerSchedule.findMany.mockResolvedValue([storedSchedule({ discountMode: DiscountMode.FIXED, baseDiscountPercent: 40 })]);
      await service.materialize(msk("2026-10-19", "09:00")); // до конца 1 ч — у динамического было бы 60%
      expect(prisma.offer.create.mock.calls[0][0].data).toMatchObject({ discountPercent: 40, discountedPrice: 18000 });
    });

    it("a dynamic template caught up late starts with the grown discount", async () => {
      await service.materialize(msk("2026-10-19", "09:00")); // осталось 60 мин → не меньше часа? ровно 1 ч: порог «<1 ч» не наступил, +10%
      expect(prisma.offer.create.mock.calls[0][0].data.discountPercent).toBe(60);
    });

    it("skips paused templates' days, skipped dates and weekends", async () => {
      prisma.offerSchedule.findMany.mockResolvedValue([storedSchedule({ skipDates: ["2026-10-19"] })]);
      expect((await service.materialize(msk("2026-10-19", "05:00"))).created).toBe(0);
      prisma.offerSchedule.findMany.mockResolvedValue([storedSchedule()]);
      expect((await service.materialize(msk("2026-10-24", "05:00"))).created).toBe(0); // суббота
    });

    it("asks the database only for active templates of active businesses", async () => {
      await service.materialize(msk("2026-10-19", "05:00"));
      expect(prisma.offerSchedule.findMany).toHaveBeenCalledWith({
        where: { isActive: true, business: { status: BusinessStatus.ACTIVE } },
        include: { business: { select: { workingHours: true, timezone: true } } },
      });
    });

    it("publishes tomorrow's morning offer in the evening when the template says so (lead 12 h)", async () => {
      prisma.offerSchedule.findMany.mockResolvedValue([storedSchedule({ publishLeadMinutes: 12 * 60 })]);
      await service.materialize(msk("2026-10-19", "19:00")); // понедельник вечер → вторник 07:00 − 12 ч = 19:00
      expect(prisma.offer.create.mock.calls[0][0].data.occurrenceDate).toBe("2026-10-20");
    });
  });

  describe("list", () => {
    it("shows the owner their templates only", async () => {
      prisma.offerSchedule.findMany.mockResolvedValue([storedSchedule()]);
      await expect(service.list(business.id, owner)).resolves.toHaveLength(1);
      await expect(service.list(business.id, stranger)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

describe("BadRequest type", () => {
  it("is what validation throws", async () => {
    const prisma = createPrismaMock();
    prisma.business.findUnique.mockResolvedValue(business);
    prisma.offerSchedule.count.mockResolvedValue(0);
    const service = new OfferSchedulesService(prisma as never);
    await expect(service.create(baseDto({ daysOfWeek: [] }), owner)).rejects.toBeInstanceOf(BadRequestException);
  });
});
