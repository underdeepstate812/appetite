import { DiscountMode, OfferStatus } from "@prisma/client";
import { DiscountSchedulerService } from "./discount-scheduler.service";

const HOUR = 3_600_000;
const offer = (over: Record<string, unknown>) => ({ id: "o", status: OfferStatus.ACTIVE, originalPrice: 10000, baseDiscountPercent: 40, discountPercent: 40, discountMode: DiscountMode.DYNAMIC, pickupEnd: new Date(Date.now() + 0.5 * HOUR), ...over });

function setup(offers: ReturnType<typeof offer>[]) {
  const prisma = {
    offer: { findMany: jest.fn().mockResolvedValue(offers), update: jest.fn().mockResolvedValue({}) },
    order: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
  };
  return { prisma, service: new DiscountSchedulerService(prisma as never) };
}

describe("DiscountSchedulerService", () => {
  it("grows a DYNAMIC offer's discount as the end of pickup approaches", async () => {
    const { prisma, service } = setup([offer({})]);
    expect((await service.run()).offersRecalculated).toBe(1);
    expect(prisma.offer.update).toHaveBeenCalledWith({ where: { id: "o" }, data: { discountPercent: 60, discountedPrice: 4000 } });
  });

  it("never touches a FIXED offer's discount, however close the end", async () => {
    const { prisma, service } = setup([offer({ discountMode: DiscountMode.FIXED })]);
    expect((await service.run()).offersRecalculated).toBe(0);
    expect(prisma.offer.update).not.toHaveBeenCalled();
  });

  it("archives finished offers of either mode", async () => {
    const past = new Date(Date.now() - HOUR);
    const { prisma, service } = setup([offer({ id: "a", pickupEnd: past }), offer({ id: "b", pickupEnd: past, discountMode: DiscountMode.FIXED })]);
    expect((await service.run()).offersArchived).toBe(2);
    expect(prisma.offer.update).toHaveBeenCalledWith({ where: { id: "b" }, data: { status: OfferStatus.ARCHIVED } });
  });
});
