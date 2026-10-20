import {
  BusinessStatus,
  DiscountMode,
  NotificationType,
  OfferCategory,
  OfferStatus,
  OrderStatus,
  Role,
  addDays,
  currentDiscountPercent,
  zonedParts,
  zonedTimeToUtc,
  type Business,
  type Notification,
  type Offer,
  type OfferSchedule,
  type Order,
  type User,
  type WorkingHours,
} from "@apetite/shared";
import { SEED_ITEMS } from "./seed-data";
import type { DemoOptions, SeedItem } from "./types";

const HOUR = 3_600_000;
const MIN = 60_000;
const DAY = 24 * HOUR;
const TZ = "Europe/Moscow";
const PASSWORD = "password123";
const STORAGE_KEY = "apetite.demo.v1";
/** Сохранённые изменения живут столько, потом витрина и окна офферов пересобираются «от сейчас» (пользователи остаются). */
const SNAPSHOT_TTL = 8 * HOUR;

export const DEMO_ACCOUNTS = {
  buyer: { email: "user@apetite.ru", password: PASSWORD },
  owner: { email: "cafe.pushkin@apetite.ru", password: PASSWORD },
} as const;

export interface DemoUser extends User {
  password: string;
}
export type StoredOffer = Offer & {
  /** Не показывать в списках (история продаж и прошлые заказы): доступно только по id. */
  hidden?: boolean;
};
export type StoredOrder = Order & { history?: boolean };

export interface DemoState {
  users: DemoUser[];
  businesses: Business[];
  offers: StoredOffer[];
  orders: StoredOrder[];
  notifications: Notification[];
  schedules: OfferSchedule[];
  createdAt: number;
}

export const PUSHKIN_ID = "b-pushkin";
export const BUYER_ID = "demo-user";
export const OWNER_ID = "demo-owner";

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
export const iso = (ms: number) => new Date(ms).toISOString();

function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const allDay = (open: string, close: string): WorkingHours => ({ "1": { open, close }, "2": { open, close }, "3": { open, close }, "4": { open, close }, "5": { open, close }, "6": { open, close }, "7": { open, close } });

function imageOf(item: SeedItem, assetBase: string): string | null {
  if (!item.image) return null;
  return "url" in item.image ? item.image.url : `${assetBase}${item.image.file}`;
}

function baseOffer(over: Partial<Offer> & Pick<Offer, "id" | "businessId" | "title" | "category" | "originalPrice" | "baseDiscountPercent" | "quantityTotal" | "weightKg" | "pickupStart" | "pickupEnd">, now: number): StoredOffer {
  const hoursToEnd = (new Date(over.pickupEnd).getTime() - now) / HOUR;
  const mode = over.discountMode ?? DiscountMode.DYNAMIC;
  const discountPercent = currentDiscountPercent(mode, over.baseDiscountPercent, hoursToEnd);
  return {
    description: null,
    discountMode: mode,
    discountPercent,
    discountedPrice: Math.round((over.originalPrice * (100 - discountPercent)) / 100),
    imageUrl: null,
    quantityLeft: over.quantityTotal,
    status: OfferStatus.ACTIVE,
    featured: false,
    ingredients: null,
    allergens: [],
    allergensDeclared: false,
    bestBefore: null,
    scheduleId: null,
    occurrenceDate: null,
    createdAt: iso(now - 2 * DAY),
    updatedAt: iso(now),
    ...over,
  };
}

function seedUsers(now: number): DemoUser[] {
  const mk = (id: string, email: string, name: string, role: Role, phone: string | null, daysAgo: number): DemoUser => ({
    id,
    email,
    name,
    role,
    phone,
    avatarUrl: null,
    expoPushToken: null,
    lastLat: null,
    lastLng: null,
    notifyRadiusKm: 5,
    createdAt: iso(now - daysAgo * DAY),
    updatedAt: iso(now - daysAgo * DAY),
    password: PASSWORD,
  });
  return [
    mk(BUYER_ID, DEMO_ACCOUNTS.buyer.email, "Тестовый пользователь", Role.USER, "+79990000001", 12),
    mk(OWNER_ID, DEMO_ACCOUNTS.owner.email, "Кафе Пушкинъ (владелец)", Role.BUSINESS, "+79990000002", 40),
    ...[1, 2, 3, 4, 5, 6].map((n) => mk(`demo-buyer-${n}`, `demo.buyer${n}@apetite.ru`, `Демо-покупатель ${n}`, Role.USER, null, 30)),
  ];
}

/** Полное «свежее» состояние: витрина от «сейчас», заведение «Кафе Пушкинъ» с историей продаж, у покупателя — заказы и эко-баллы. */
export function createState(options: DemoOptions, now: number): DemoState {
  const users = seedUsers(now);
  const businesses: Business[] = [];
  const offers: StoredOffer[] = [];
  const orders: StoredOrder[] = [];
  const businessOf = new Map<string, Business>();

  // --- «Кафе Пушкинъ»: заведение, на котором работает кабинет бизнеса
  const pushkin: Business = {
    id: PUSHKIN_ID,
    ownerUserId: OWNER_ID,
    name: "Кафе Пушкинъ",
    description: "Домашняя кухня и выпечка у метро «Пушкинская».",
    category: OfferCategory.FOOD,
    address: "Санкт-Петербург, Невский проспект, 20",
    lat: 59.9343,
    lng: 30.3351,
    status: BusinessStatus.ACTIVE,
    commissionPercent: 25,
    logoUrl: null,
    trialEndsAt: iso(now + 25 * DAY),
    timezone: TZ,
    workingHours: allDay("00:00", "00:00"),
    createdAt: iso(now - 40 * DAY),
    updatedAt: iso(now - DAY),
  };
  businesses.push(pushkin);
  businessOf.set(pushkin.name, pushkin);

  // --- витрина: 59 предложений 58 заведений
  SEED_ITEMS.forEach((item, index) => {
    let business = businessOf.get(item.shop);
    if (!business) {
      business = {
        id: `b-${index}`,
        ownerUserId: `demo-owner-${index}`,
        name: item.shop,
        description: null,
        category: item.category as OfferCategory,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        status: BusinessStatus.ACTIVE,
        commissionPercent: 25,
        logoUrl: null,
        trialEndsAt: iso(now + 20 * DAY),
        timezone: TZ,
        workingHours: null,
        createdAt: iso(now - 60 * DAY),
        updatedAt: iso(now - 60 * DAY),
      };
      businesses.push(business);
      businessOf.set(item.shop, business);
    }
    const pickupEnd = now + item.hoursToEnd * HOUR;
    offers.push(
      baseOffer(
        {
          id: `o-${index}`,
          businessId: business.id,
          title: item.title,
          description: item.description,
          category: item.category as OfferCategory,
          originalPrice: item.originalPriceRub * 100,
          baseDiscountPercent: item.baseDiscountPercent,
          imageUrl: imageOf(item, options.assetBase),
          quantityTotal: item.quantityTotal,
          weightKg: item.weightKg,
          pickupStart: iso(now - HOUR),
          pickupEnd: iso(pickupEnd),
          ingredients: item.ingredients,
          allergens: item.allergens,
          allergensDeclared: item.allergensDeclared,
          bestBefore: item.shelfHours === null ? null : iso(pickupEnd + item.shelfHours * HOUR),
        },
        now
      )
    );
  });

  // --- предложения «Кафе Пушкинъ» (то, что владелец видит в кабинете)
  const own = (suffix: string, title: string, category: OfferCategory, priceRub: number, base: number, mode: DiscountMode, qty: number, fromH: number, toH: number, food: { ingredients: string; allergens: string[]; shelf: number }, image: string | null, left?: number) =>
    offers.push(
      baseOffer(
        {
          id: `o-pushkin-${suffix}`,
          businessId: PUSHKIN_ID,
          title,
          category,
          originalPrice: priceRub * 100,
          baseDiscountPercent: base,
          discountMode: mode,
          quantityTotal: qty,
          quantityLeft: left ?? qty,
          weightKg: 0.4,
          pickupStart: iso(now + fromH * HOUR),
          pickupEnd: iso(now + toH * HOUR),
          ingredients: food.ingredients,
          allergens: food.allergens,
          allergensDeclared: true,
          bestBefore: iso(now + (toH + food.shelf) * HOUR),
          imageUrl: image,
        },
        now
      )
    );
  own("bakery", "Набор выпечки дня", OfferCategory.BAKERY, 450, 40, DiscountMode.DYNAMIC, 8, -1, 3.5, { ingredients: "Мука, масло, молоко, сахар, яйца", allergens: ["gluten", "milk", "eggs"], shelf: 8 }, `${options.assetBase}cappuccino.jpg`, 6);
  own("lunch", "Бизнес-ланч (не разобранный)", OfferCategory.FOOD, 630, 30, DiscountMode.DYNAMIC, 10, -2, 2.2, { ingredients: "Суп дня, горячее блюдо с гарниром, салат, хлеб", allergens: ["gluten", "milk"], shelf: 4 }, `${options.assetBase}steak.jpg`, 7);
  own("dessert", "Десерты дня", OfferCategory.BAKERY, 520, 45, DiscountMode.FIXED, 6, -0.5, 5, { ingredients: "Бисквит, сливки, ягоды, сахар", allergens: ["gluten", "milk", "eggs"], shelf: 12 }, `${options.assetBase}cappuccino-shake.jpg`);

  const rand = rng(20261018);
  const today = zonedParts(now, TZ).date;

  // --- история продаж «Кафе Пушкинъ» за 40 дней (для графика в кабинете)
  const titles = ["Набор выпечки дня", "Бизнес-ланч (не разобранный)", "Десерты дня", "Хлеб и булочки"];
  const buyers = users.filter((u) => u.id.startsWith("demo-buyer-"));
  for (let back = 39; back >= 0; back -= 1) {
    const date = addDays(today, -back);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const growth = 1 + (40 - back) / 40;
    const visitors = Math.max(0, Math.round((weekend ? 6.5 : 3.8) * growth * (0.65 + rand() * 0.7)) - (rand() < 0.08 ? 3 : 0));
    const pickupStart = zonedTimeToUtc(date, "17:00", TZ).getTime();
    const pickupEnd = zonedTimeToUtc(date, "21:00", TZ).getTime();
    const price = 45_000 + Math.round(rand() * 4) * 5000;
    const offerId = `o-hist-${back}`;
    let sold = 0;
    for (let i = 0; i < visitors; i += 1) {
      const roll = rand();
      const hoursToEnd = roll < 0.18 ? 4.2 + rand() * 1.8 : roll < 0.38 ? 2 + rand() * 2 : roll < 0.66 ? 1 + rand() : rand();
      const createdAt = pickupEnd - hoursToEnd * HOUR - rand() * 10 * MIN;
      if (createdAt > now) continue;
      const percent = hoursToEnd < 1 ? 60 : hoursToEnd < 2 ? 50 : 40;
      const quantity = rand() < 0.2 ? 2 : 1;
      if (sold + quantity > 12) break;
      sold += quantity;
      const total = Math.round((price * (100 - percent)) / 100) * quantity;
      const fate = rand();
      const status = back === 0 && createdAt > now - 3 * HOUR ? OrderStatus.CONFIRMED : fate < 0.08 ? OrderStatus.CANCELLED : fate < 0.12 ? OrderStatus.EXPIRED : OrderStatus.COMPLETED;
      orders.push({
        id: `ord-hist-${back}-${i}`,
        userId: buyers[Math.floor(rand() * buyers.length)].id,
        offerId,
        businessId: PUSHKIN_ID,
        quantity,
        totalPrice: total,
        platformFee: 0,
        status,
        pickupCode: String(Math.floor(rand() * 1_000_000)).padStart(6, "0"),
        createdAt: iso(createdAt),
        acceptedAt: status === OrderStatus.CONFIRMED ? null : iso(createdAt + 5 * MIN),
        completedAt: status === OrderStatus.COMPLETED ? iso(Math.min(pickupEnd, createdAt + HOUR)) : null,
        receiptConfirmedAt: status === OrderStatus.COMPLETED ? iso(Math.min(pickupEnd, createdAt + 2 * HOUR)) : null,
        history: true,
      });
    }
    offers.push(
      baseOffer(
        {
          id: offerId,
          businessId: PUSHKIN_ID,
          title: titles[(40 - back) % titles.length],
          category: OfferCategory.BAKERY,
          originalPrice: price,
          baseDiscountPercent: 40,
          quantityTotal: 12,
          quantityLeft: 12 - sold,
          weightKg: 0.4,
          pickupStart: iso(pickupStart),
          pickupEnd: iso(pickupEnd),
          status: OfferStatus.ARCHIVED,
        },
        now
      ) as StoredOffer
    );
    offers[offers.length - 1].hidden = true;
  }

  // --- покупатель: прошлые заказы (эко-баллы), один ждёт самовывоза, один — подтвердить получение
  const pastShops = [0, 1, 2, 5, 8, 11, 14, 17];
  pastShops.forEach((seedIndex, k) => {
    const item = SEED_ITEMS[seedIndex];
    const business = businessOf.get(item.shop)!;
    const end = now - (k + 1) * 26 * HOUR;
    const offerId = `o-past-${k}`;
    offers.push(
      {
        ...baseOffer(
          {
            id: offerId,
            businessId: business.id,
            title: item.title,
            category: item.category as OfferCategory,
            originalPrice: item.originalPriceRub * 100,
            baseDiscountPercent: item.baseDiscountPercent,
            imageUrl: imageOf(item, options.assetBase),
            quantityTotal: item.quantityTotal,
            weightKg: item.weightKg,
            pickupStart: iso(end - 3 * HOUR),
            pickupEnd: iso(end),
            status: OfferStatus.ARCHIVED,
            ingredients: item.ingredients,
            allergens: item.allergens,
            allergensDeclared: item.allergensDeclared,
          },
          now
        ),
        hidden: true,
      }
    );
    const total = Math.round(item.originalPriceRub * 100 * (1 - (item.baseDiscountPercent + 10) / 100));
    orders.push({
      id: `ord-past-${k}`,
      userId: BUYER_ID,
      offerId,
      businessId: business.id,
      quantity: 1,
      totalPrice: total,
      platformFee: 0,
      status: OrderStatus.COMPLETED,
      pickupCode: String(100_000 + k * 7919).slice(0, 6),
      createdAt: iso(end - 2 * HOUR),
      acceptedAt: iso(end - 2 * HOUR + 5 * MIN),
      completedAt: iso(end - HOUR),
      receiptConfirmedAt: k === 0 ? null : iso(end - 30 * MIN),
    });
  });
  const waiting = offers.find((o) => o.id === "o-4")!;
  orders.push({
    id: "ord-waiting",
    userId: BUYER_ID,
    offerId: waiting.id,
    businessId: waiting.businessId,
    quantity: 1,
    totalPrice: waiting.discountedPrice,
    platformFee: 0,
    status: OrderStatus.CONFIRMED,
    pickupCode: "482917",
    createdAt: iso(now - 20 * MIN),
    acceptedAt: null,
  });

  const notifications: Notification[] = [
    { id: "n-1", userId: BUYER_ID, type: NotificationType.ORDER_CONFIRMED, title: "Заказ оплачен", body: `${waiting.title} — заберите самовывозом, код 482917.`, data: { orderId: "ord-waiting" }, read: false, createdAt: iso(now - 20 * MIN) },
    { id: "n-2", userId: BUYER_ID, type: NotificationType.NEARBY_OFFERS, title: "Рядом горячие скидки", body: "В вашем районе появились новые предложения со скидкой до 70%.", data: null, read: false, createdAt: iso(now - 3 * HOUR) },
    { id: "n-3", userId: BUYER_ID, type: NotificationType.ORDER_COMPLETED, title: "Заказ получен", body: "Спасибо! Вы спасли еду от выброса.", data: { orderId: "ord-past-1" }, read: true, createdAt: iso(now - 2 * DAY) },
  ];

  const schedules: OfferSchedule[] = [
    {
      id: "s-breakfast",
      businessId: PUSHKIN_ID,
      title: "Круассан и кофе",
      description: null,
      category: OfferCategory.BAKERY,
      originalPrice: 30_000,
      baseDiscountPercent: 40,
      discountMode: DiscountMode.DYNAMIC,
      imageUrl: `${options.assetBase}cappuccino.jpg`,
      quantityTotal: 8,
      weightKg: 0.3,
      ingredients: "Мука, масло, молоко, кофе",
      allergens: ["gluten", "milk"],
      allergensDeclared: true,
      bestBeforeHoursAfterEnd: 6,
      daysOfWeek: [1, 2, 3, 4, 5],
      pickupStartTime: "07:00",
      pickupEndTime: "10:00",
      publishLeadMinutes: 180,
      timezone: TZ,
      startsOn: null,
      endsOn: null,
      skipDates: [],
      isActive: true,
      createdAt: iso(now - 20 * DAY),
      updatedAt: iso(now - 20 * DAY),
    },
    {
      id: "s-evening",
      businessId: PUSHKIN_ID,
      title: "Вечерняя выпечка",
      description: null,
      category: OfferCategory.BAKERY,
      originalPrice: 40_000,
      baseDiscountPercent: 45,
      discountMode: DiscountMode.FIXED,
      imageUrl: null,
      quantityTotal: 6,
      weightKg: 0.5,
      ingredients: "Мука, масло, сахар, яйца",
      allergens: ["gluten", "milk", "eggs"],
      allergensDeclared: true,
      bestBeforeHoursAfterEnd: 8,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      pickupStartTime: "18:00",
      pickupEndTime: "21:00",
      publishLeadMinutes: 180,
      timezone: TZ,
      startsOn: null,
      endsOn: null,
      skipDates: [],
      isActive: false,
      createdAt: iso(now - 10 * DAY),
      updatedAt: iso(now - 10 * DAY),
    },
  ];

  const state: DemoState = { users, businesses, offers, orders, notifications, schedules, createdAt: now };
  recomputeStock(state);
  return state;
}

/** Остаток показанных предложений = всего − заказы (кроме отменённых/просроченных): так повторная загрузка не «воскрешает» купленное. */
export function recomputeStock(state: DemoState) {
  const sold = new Map<string, number>();
  for (const order of state.orders) {
    if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.COMPLETED) sold.set(order.offerId, (sold.get(order.offerId) ?? 0) + order.quantity);
  }
  for (const offer of state.offers) {
    if (offer.hidden || offer.id.startsWith("o-hist")) continue;
    const left = Math.max(0, offer.quantityTotal - (sold.get(offer.id) ?? 0));
    offer.quantityLeft = left;
    if (offer.status === OfferStatus.ACTIVE && left === 0) offer.status = OfferStatus.SOLD_OUT;
  }
}

// ---------------- сохранение между перезагрузками ----------------

interface Snapshot {
  v: 1;
  savedAt: number;
  users: DemoUser[];
  orders: StoredOrder[];
  notifications: Notification[];
  schedules: OfferSchedule[];
  businesses: Business[];
  ownOffers: StoredOffer[];
}

function storageOf(options: DemoOptions) {
  if (options.storage !== undefined) return options.storage;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Пишем только то, что пользователь изменил: аккаунты, заказы, уведомления, заведение «Пушкинъ» с его офферами и шаблонами. */
export function saveState(state: DemoState, options: DemoOptions, now: number) {
  const storage = storageOf(options);
  if (!storage) return;
  const snapshot: Snapshot = {
    v: 1,
    savedAt: now,
    users: state.users,
    orders: state.orders.filter((order) => !order.history),
    notifications: state.notifications,
    schedules: state.schedules,
    businesses: state.businesses.filter((business) => business.id === PUSHKIN_ID),
    ownOffers: state.offers.filter((offer) => offer.businessId === PUSHKIN_ID && !offer.id.startsWith("o-hist")),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // квота (например, большое фото) — демо продолжает работать, просто без сохранения
  }
}

export function resetSavedState(options: DemoOptions) {
  try {
    storageOf(options)?.removeItem(STORAGE_KEY);
  } catch {
    /* не критично */
  }
}

export function loadState(options: DemoOptions, now: number): DemoState {
  const fresh = createState(options, now);
  const storage = storageOf(options);
  if (!storage) return fresh;
  let snapshot: Snapshot | null = null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    snapshot = raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    snapshot = null;
  }
  if (!snapshot || snapshot.v !== 1) return fresh;

  // Аккаунты (в том числе зарегистрированные и с изменённым профилем) переживают любую перезагрузку.
  const known = new Set(snapshot.users.map((user) => user.id));
  fresh.users = [...snapshot.users, ...fresh.users.filter((user) => !known.has(user.id))];

  if (now - snapshot.savedAt > SNAPSHOT_TTL) return fresh; // окна офферов устарели — витрина и заказы заново
  const seedOrderIds = new Set(fresh.orders.map((order) => order.id));
  const savedById = new Map(snapshot.orders.map((order) => [order.id, order]));
  fresh.orders = [...fresh.orders.map((order) => savedById.get(order.id) ?? order), ...snapshot.orders.filter((order) => !seedOrderIds.has(order.id))];
  fresh.notifications = snapshot.notifications;
  fresh.schedules = snapshot.schedules;
  fresh.businesses = fresh.businesses.map((business) => snapshot!.businesses.find((saved) => saved.id === business.id) ?? business);
  const historyOffers = fresh.offers.filter((offer) => offer.id.startsWith("o-hist"));
  const showcase = fresh.offers.filter((offer) => offer.businessId !== PUSHKIN_ID);
  fresh.offers = [...showcase, ...snapshot.ownOffers, ...historyOffers];
  recomputeStock(fresh);
  return fresh;
}
