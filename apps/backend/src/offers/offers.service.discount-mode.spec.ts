import { DiscountMode, OfferCategory, Role } from "@prisma/client";
import { OffersService } from "./offers.service";
import type { RequestUser } from "../common/interfaces/authenticated-request.interface";

const HOUR = 3_600_000;
const owner = { userId: "owner", role: Role.BUSINESS } as RequestUser;

function setup(existing?: Record<string, unknown>) {
  const prisma = {
    business: { findUnique: jest.fn().mockResolvedValue({ id: "b", ownerUserId: "owner" }) },
    offer: {
      create: jest.fn().mockImplementation(async ({ data }: { data: object }) => data),
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockImplementation(async ({ data }: { data: object }) => data),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  return { prisma, service: new OffersService(prisma as never) };
}

const dto = (over: Record<string, unknown> = {}) => ({
  businessId: "b",
  title: "Набор",
  category: OfferCategory.FLOWERS,
  originalPriceRub: 1000,
  weightKg: 1,
  quantityTotal: 3,
  baseDiscountPercent: 40,
  pickupStart: new Date(Date.now() - HOUR).toISOString(),
  pickupEnd: new Date(Date.now() + 0.5 * HOUR).toISOString(), // меньше часа до конца
  ...over,
});

describe("OffersService: discount mode", () => {
  it("DYNAMIC is the default and starts already grown when the end is near", async () => {
    const { service } = setup();
    expect(await service.create(dto() as never, owner)).toMatchObject({ discountMode: DiscountMode.DYNAMIC, discountPercent: 60, discountedPrice: 40000 });
  });

  it("FIXED stays at the owner's discount from the very first second", async () => {
    const { service } = setup();
    expect(await service.create(dto({ discountMode: DiscountMode.FIXED }) as never, owner)).toMatchObject({ discountMode: DiscountMode.FIXED, discountPercent: 40, discountedPrice: 60000 });
  });

  it("switching an offer to FIXED recalculates at once; back to DYNAMIC grows again", async () => {
    const existing = {
      id: "o", business: { ownerUserId: "owner" }, discountMode: DiscountMode.DYNAMIC, baseDiscountPercent: 40, originalPrice: 100000,
      category: OfferCategory.FLOWERS, pickupStart: new Date(Date.now() - HOUR), pickupEnd: new Date(Date.now() + 0.5 * HOUR), imageUrl: null,
      ingredients: null, allergens: [], allergensDeclared: false, bestBefore: null,
    };
    const { service, prisma } = setup(existing);
    expect(await service.update("o", { discountMode: DiscountMode.FIXED } as never, owner)).toMatchObject({ discountMode: DiscountMode.FIXED, discountPercent: 40, discountedPrice: 60000 });
    prisma.offer.findUnique.mockResolvedValue({ ...existing, discountMode: DiscountMode.FIXED });
    expect(await service.update("o", { discountMode: DiscountMode.DYNAMIC } as never, owner)).toMatchObject({ discountMode: DiscountMode.DYNAMIC, discountPercent: 60 });
  });

  it("a price change on a FIXED offer keeps the percent", async () => {
    const { service } = setup({
      id: "o", business: { ownerUserId: "owner" }, discountMode: DiscountMode.FIXED, baseDiscountPercent: 40, originalPrice: 100000,
      category: OfferCategory.FLOWERS, pickupStart: new Date(Date.now() - HOUR), pickupEnd: new Date(Date.now() + 0.5 * HOUR), imageUrl: null,
      ingredients: null, allergens: [], allergensDeclared: false, bestBefore: null,
    });
    expect(await service.update("o", { originalPriceRub: 2000 } as never, owner)).toMatchObject({ discountPercent: 40, discountedPrice: 120000 });
  });
});
