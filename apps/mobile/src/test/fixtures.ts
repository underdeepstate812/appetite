import type { NearbyOffer } from "@apetite/shared";

/** Предложение для тестов: окно закрывается через `minutesLeft` минут от `now` (по умолчанию — от текущего времени). */
export function makeNearbyOffer(id: string, overrides: Partial<NearbyOffer> & { minutesLeft?: number; now?: number } = {}): NearbyOffer {
  const { minutesLeft = 45, now = Date.now(), ...rest } = overrides;
  return {
    id,
    businessId: `b-${id}`,
    title: `Предложение ${id}`,
    description: null,
    category: "FOOD",
    originalPrice: 40000,
    discountedPrice: 16000,
    discountPercent: 60,
    baseDiscountPercent: 30,
    imageUrl: null,
    quantityTotal: 10,
    quantityLeft: 6,
    weightKg: 0.4,
    pickupStart: new Date(now - 60 * 60_000).toISOString(),
    pickupEnd: new Date(now + minutesLeft * 60_000).toISOString(),
    status: "ACTIVE",
    featured: false,
    createdAt: new Date(now - 3 * 3_600_000).toISOString(),
    updatedAt: new Date(now - 3 * 3_600_000).toISOString(),
    businessName: `Заведение ${id}`,
    businessAddress: "Невский пр., 1",
    businessLat: 59.93,
    businessLng: 30.33,
    businessLogoUrl: null,
    distanceKm: 1.2,
    ...rest,
  } as NearbyOffer;
}
