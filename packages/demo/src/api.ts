import QRCode from "qrcode";
import {
  DISCOUNT_RULES,
  DiscountMode,
  ECO_POINTS_PER_KG,
  INGREDIENTS_MAX_LENGTH,
  INGREDIENTS_MIN_LENGTH,
  NotificationType,
  OFFER_ALLERGENS,
  OfferCategory,
  OfferStatus,
  OrderStatus,
  ReceiptDisputeReason,
  Role,
  SCHEDULE_RULES,
  STRONG_PASSWORD_REGEX,
  bestBeforeFor,
  buildSalesSeries,
  currentDiscountPercent,
  dueOccurrences,
  getEcoLevel,
  getNextEcoLevel,
  normalizeWorkingHours,
  offerWindowHoursProblem,
  requiresFoodInfo,
  salesWindowStart,
  scheduleHoursProblem,
  validateOfferWindow,
  validateScheduleTiming,
  validateWorkingHours,
  zonedParts,
  type Business,
  type BusinessStats,
  type NearbyOffer,
  type Offer,
  type OfferSchedule,
  type User,
} from "@apetite/shared";
import { BUYER_ID, PUSHKIN_ID, loadState, resetSavedState, saveState, uid, iso, type DemoState, type DemoUser, type StoredOffer, type StoredOrder } from "./state";
import type { DemoOptions } from "./types";

const HOUR = 3_600_000;

export interface DemoRequest {
  method: string;
  /** Путь относительно apiBase, без query: «/offers/nearby». */
  path: string;
  query: URLSearchParams;
  body: unknown;
  /** Загруженный файл (multipart): поле → File. */
  files: Record<string, File>;
  token: string | null;
}
export interface DemoResponse {
  status: number;
  data: unknown;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

const num = (value: unknown): number => (typeof value === "number" ? value : Number(value));
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

const publicUser = (user: DemoUser): User => {
  const { password: _password, ...rest } = user;
  return rest;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

async function fileToDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${file.type || "image/jpeg"};base64,${btoa(binary)}`;
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function createDemoApi(options: DemoOptions) {
  const clock = options.now ?? Date.now;
  let state: DemoState = loadState(options, clock());
  const verifiedPhones = new Set<string>();

  const persist = () => saveState(state, options, clock());

  // ---------- общие помощники ----------
  const userOf = (token: string | null): DemoUser => {
    const id = token?.match(/^demo\.([^.]+)\./)?.[1];
    const user = id ? state.users.find((candidate) => candidate.id === id) : undefined;
    return user ?? fail(401, "Сессия истекла — войдите снова");
  };
  const businessOf = (id: string): Business => state.businesses.find((business) => business.id === id) ?? fail(404, "Заведение не найдено");
  const ownBusiness = (user: DemoUser): Business => state.businesses.find((business) => business.ownerUserId === user.id) ?? fail(404, "Заведение не найдено для этого аккаунта");
  const assertOwnerOrAdmin = (business: Business, user: DemoUser) => {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.BUSINESS && business.ownerUserId === user.id) return;
    fail(403, "Недостаточно прав для этого заведения");
  };

  /** Предложение «как его отдал бы backend сейчас»: скидка по времени, истёкшее — в архиве. */
  const view = (stored: StoredOffer): Offer => {
    const now = clock();
    const end = new Date(stored.pickupEnd).getTime();
    if ((stored.status === OfferStatus.ACTIVE || stored.status === OfferStatus.SOLD_OUT) && end <= now) stored.status = OfferStatus.ARCHIVED;
    if (stored.status === OfferStatus.ACTIVE && stored.discountMode !== DiscountMode.FIXED) {
      const percent = currentDiscountPercent(stored.discountMode, stored.baseDiscountPercent, (end - now) / HOUR);
      stored.discountPercent = percent;
      stored.discountedPrice = Math.round((stored.originalPrice * (100 - percent)) / 100);
    }
    const { hidden: _hidden, ...offer } = stored;
    return { ...offer };
  };
  const findOffer = (id: string): StoredOffer => state.offers.find((offer) => offer.id === id) ?? fail(404, "Оффер не найден");
  const offerOwnerBusiness = (offer: StoredOffer) => businessOf(offer.businessId);

  const assertFoodInfo = (input: { category: string; ingredients?: string | null; allergens?: string[] | null; bestBefore?: number | null; pickupEnd: number }, strict: boolean) => {
    const ingredients = input.ingredients?.trim() ?? "";
    const unknown = (input.allergens ?? []).filter((code) => !(OFFER_ALLERGENS as readonly string[]).includes(code));
    if (unknown.length > 0) fail(400, `Неизвестные аллергены: ${unknown.join(", ")}`);
    if (ingredients.length > INGREDIENTS_MAX_LENGTH) fail(400, `Состав слишком длинный (не больше ${INGREDIENTS_MAX_LENGTH} символов)`);
    if (input.bestBefore && input.bestBefore < input.pickupEnd) fail(400, "Срок годности не может заканчиваться раньше конца времени самовывоза");
    if (!strict || !requiresFoodInfo(input.category as OfferCategory)) return;
    if (ingredients.length < INGREDIENTS_MIN_LENGTH) fail(400, "Укажите состав: покупатель должен видеть его до оплаты");
    if (!input.allergens) fail(400, "Укажите аллергены или отметьте, что их нет");
    if (!input.bestBefore) fail(400, "Укажите срок годности");
  };

  const assertWindow = (business: Business, start: number, end: number, opts: { requireFuture: boolean; checkHours: boolean }) => {
    const now = clock();
    if (opts.requireFuture && end <= now) fail(400, "Окно самовывоза уже закончилось: выбери конец в будущем");
    const problem = validateOfferWindow(start, end, { nowMs: now, checkHorizon: opts.requireFuture });
    if (problem) fail(400, problem);
    if (opts.checkHours && business.workingHours) {
      const hoursProblem = offerWindowHoursProblem(normalizeWorkingHours(business.workingHours), business.timezone, start, end);
      if (hoursProblem) fail(400, hoursProblem);
    }
  };

  const applyDiscount = (offer: StoredOffer) => {
    const hoursToEnd = (new Date(offer.pickupEnd).getTime() - clock()) / HOUR;
    offer.discountPercent = currentDiscountPercent(offer.discountMode, offer.baseDiscountPercent, hoursToEnd);
    offer.discountedPrice = Math.round((offer.originalPrice * (100 - offer.discountPercent)) / 100);
  };

  /** Автовыкладка: как cron на backend — создаёт офферы по активным шаблонам, которым пора появиться. */
  const materialize = () => {
    const now = clock();
    for (const schedule of state.schedules) {
      if (!schedule.isActive) continue;
      const business = businessOf(schedule.businessId);
      const hours = business.workingHours ? normalizeWorkingHours(business.workingHours) : null;
      for (const occurrence of dueOccurrences(schedule, now)) {
        if (state.offers.some((offer) => offer.scheduleId === schedule.id && offer.occurrenceDate === occurrence.date)) continue;
        if (offerWindowHoursProblem(hours, business.timezone, occurrence.pickupStart.getTime(), occurrence.pickupEnd.getTime())) continue;
        const bestBefore = bestBeforeFor(occurrence.pickupEnd, schedule.bestBeforeHoursAfterEnd, schedule.category);
        const offer: StoredOffer = {
          id: uid("o-auto"),
          businessId: schedule.businessId,
          scheduleId: schedule.id,
          occurrenceDate: occurrence.date,
          title: schedule.title,
          description: schedule.description ?? null,
          category: schedule.category,
          originalPrice: schedule.originalPrice,
          baseDiscountPercent: schedule.baseDiscountPercent,
          discountMode: schedule.discountMode,
          discountPercent: schedule.baseDiscountPercent,
          discountedPrice: schedule.originalPrice,
          imageUrl: schedule.imageUrl ?? null,
          quantityTotal: schedule.quantityTotal,
          quantityLeft: schedule.quantityTotal,
          weightKg: schedule.weightKg,
          pickupStart: iso(occurrence.pickupStart.getTime()),
          pickupEnd: iso(occurrence.pickupEnd.getTime()),
          status: OfferStatus.ACTIVE,
          featured: false,
          ingredients: schedule.ingredients ?? null,
          allergens: schedule.allergens ?? [],
          allergensDeclared: schedule.allergensDeclared ?? false,
          bestBefore: bestBefore ? iso(bestBefore.getTime()) : null,
          createdAt: iso(now),
          updatedAt: iso(now),
        };
        applyDiscount(offer);
        state.offers.push(offer);
      }
    }
  };

  const issueTokens = (user: DemoUser) => ({ accessToken: `demo.${user.id}.a${Math.random().toString(36).slice(2, 8)}`, refreshToken: `demo.${user.id}.r${Math.random().toString(36).slice(2, 8)}` });

  const notify = (userId: string, type: NotificationType, title: string, body: string, data?: Record<string, string>) => {
    state.notifications.unshift({ id: uid("n"), userId, type, title, body, data: data ?? null, read: false, createdAt: iso(clock()) });
  };

  // ---------- маршруты ----------
  const routes: Array<{ method: string; pattern: RegExp; handler: (req: DemoRequest, match: RegExpMatchArray) => Promise<unknown> | unknown; mutating?: boolean }> = [];
  const route = (method: string, pattern: RegExp, handler: (req: DemoRequest, match: RegExpMatchArray) => Promise<unknown> | unknown, mutating = false) => routes.push({ method, pattern, handler, mutating });

  // --- auth
  route("POST", /^\/auth\/login$/, (req) => {
    const body = record(req.body);
    const identifier = str(body.identifier).trim().toLowerCase();
    const user = state.users.find((candidate) => candidate.email.toLowerCase() === identifier || candidate.phone === identifier);
    if (!user || user.password !== str(body.password)) fail(401, "Неверный email/телефон или пароль");
    return { ...issueTokens(user!), user: publicUser(user!) };
  });
  route(
    "POST",
    /^\/auth\/register$/,
    (req) => {
      const body = record(req.body);
      const email = str(body.email).trim();
      const name = str(body.name).trim();
      const password = str(body.password);
      if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, "email must be an email");
      if (name.length < 2) fail(400, "name must be longer than or equal to 2 characters");
      if (!STRONG_PASSWORD_REGEX.test(password)) fail(400, "Пароль должен содержать заглавную и строчную буквы, цифру и спецсимвол");
      if (state.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) fail(409, "Пользователь с таким email уже существует");
      const phone = str(body.phone) || null;
      if (phone && !verifiedPhones.has(phone)) fail(400, "Подтвердите телефон кодом из SMS");
      const now = iso(clock());
      const user: DemoUser = { id: uid("u"), email, name, role: Role.USER, phone, avatarUrl: null, expoPushToken: null, lastLat: null, lastLng: null, notifyRadiusKm: 5, createdAt: now, updatedAt: now, password };
      state.users.push(user);
      return { ...issueTokens(user), user: publicUser(user) };
    },
    true
  );
  route("POST", /^\/auth\/otp\/request$/, () => ({ success: true }));
  route("POST", /^\/auth\/otp\/verify$/, (req) => {
    const body = record(req.body);
    if (!/^\d{4,8}$/.test(str(body.code))) fail(400, "Неверный код");
    verifiedPhones.add(str(body.phone));
    return { verified: true };
  });
  route("GET", /^\/auth\/me$/, (req) => publicUser(userOf(req.token)));
  route("POST", /^\/auth\/logout$/, () => ({ success: true }));
  route("POST", /^\/auth\/refresh$/, (req) => issueTokens(userOf(req.token)));

  // --- users
  route(
    "PATCH",
    /^\/users\/me$/,
    (req) => {
      const user = userOf(req.token);
      const body = record(req.body);
      if (body.name !== undefined) {
        const name = str(body.name).trim();
        if (name.length < 2) fail(400, "name must be longer than or equal to 2 characters");
        user.name = name;
      }
      if (body.email !== undefined) {
        const email = str(body.email).trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, "email must be an email");
        if (state.users.some((other) => other.id !== user.id && other.email.toLowerCase() === email.toLowerCase())) fail(409, "Этот email уже используется другим аккаунтом");
        user.email = email;
      }
      user.updatedAt = iso(clock());
      return publicUser(user);
    },
    true
  );
  route(
    "POST",
    /^\/users\/me\/avatar$/,
    async (req) => {
      const user = userOf(req.token);
      const file = req.files.avatar ?? fail(400, "Файл не получен");
      if (!PHOTO_TYPES.includes(file.type)) fail(400, "Разрешены только JPEG/PNG/WebP");
      if (file.size > 5 * 1024 * 1024) fail(400, "Файл больше 5 МБ");
      user.avatarUrl = await fileToDataUrl(file);
      return publicUser(user);
    },
    true
  );
  route(
    "PATCH",
    /^\/users\/me\/location$/,
    (req) => {
      const user = userOf(req.token);
      const body = record(req.body);
      user.lastLat = num(body.lat);
      user.lastLng = num(body.lng);
      return publicUser(user);
    },
    true
  );

  // --- businesses
  route("GET", /^\/businesses\/mine$/, (req) => {
    const user = userOf(req.token);
    if (user.role !== Role.BUSINESS) fail(403, "Недостаточно прав для этого действия");
    return state.businesses.filter((business) => business.ownerUserId === user.id);
  });
  route("GET", /^\/businesses$/, (req) => {
    const category = req.query.get("category");
    return state.businesses.filter((business) => !category || business.category === category);
  });
  route("GET", /^\/businesses\/([^/]+)\/stats$/, (req, match) => {
    const business = businessOf(match[1]);
    assertOwnerOrAdmin(business, userOf(req.token));
    materialize();
    const orders = state.orders.filter((order) => order.businessId === business.id);
    const count = (status: OrderStatus) => orders.filter((order) => order.status === status).length;
    const completed = orders.filter((order) => order.status === OrderStatus.COMPLETED);
    const weight = completed.reduce((sum, order) => sum + (state.offers.find((offer) => offer.id === order.offerId)?.weightKg ?? 0) * order.quantity, 0);
    const stats: BusinessStats = {
      activeOffersCount: state.offers.filter((offer) => offer.businessId === business.id && !offer.hidden && view(offer).status === OfferStatus.ACTIVE).length,
      totalOrders: orders.length,
      confirmedOrders: count(OrderStatus.CONFIRMED),
      completedOrders: count(OrderStatus.COMPLETED),
      cancelledOrders: count(OrderStatus.CANCELLED),
      expiredOrders: count(OrderStatus.EXPIRED),
      disputedOrders: orders.filter((order) => order.receiptDisputedAt).length,
      revenue: completed.reduce((sum, order) => sum + order.totalPrice, 0),
      platformFee: completed.reduce((sum, order) => sum + order.platformFee, 0),
      weightSavedKg: weight,
    };
    return stats;
  });
  route("GET", /^\/businesses\/([^/]+)\/sales$/, (req, match) => {
    const business = businessOf(match[1]);
    assertOwnerOrAdmin(business, userOf(req.token));
    const days = num(req.query.get("days") ?? 14);
    if (![7, 14, 30].includes(days)) fail(400, "days must be one of the following values: 7, 14, 30");
    const now = clock();
    const orders = state.orders.filter((order) => order.businessId === business.id);
    const windowStart = salesWindowStart(days, now).getTime();
    const sales = buildSalesSeries(
      orders
        .filter((order) => new Date(order.createdAt).getTime() >= windowStart)
        .map((order) => ({
          createdAt: new Date(order.createdAt).getTime(),
          status: order.status,
          totalPrice: order.totalPrice,
          quantity: order.quantity,
          offerPickupEnd: new Date(state.offers.find((offer) => offer.id === order.offerId)?.pickupEnd ?? order.createdAt).getTime(),
        })),
      { days, now, firstOrderAt: orders.length ? Math.min(...orders.map((order) => new Date(order.createdAt).getTime())) : null }
    );
    return sales;
  });
  route("GET", /^\/businesses\/([^/]+)$/, (_req, match) => businessOf(match[1]));
  route(
    "PATCH",
    /^\/businesses\/([^/]+)$/,
    (req, match) => {
      const business = businessOf(match[1]);
      assertOwnerOrAdmin(business, userOf(req.token));
      const body = record(req.body);
      if (typeof body.name === "string" && body.name.trim().length >= 2) business.name = body.name.trim();
      if (typeof body.description === "string") business.description = body.description;
      if (typeof body.address === "string" && body.address.trim()) business.address = body.address.trim();
      business.updatedAt = iso(clock());
      return business;
    },
    true
  );
  route(
    "PUT",
    /^\/businesses\/([^/]+)\/working-hours$/,
    (req, match) => {
      const business = businessOf(match[1]);
      assertOwnerOrAdmin(business, userOf(req.token));
      const raw = record(req.body).workingHours;
      let hours = null;
      if (raw !== null && raw !== undefined) {
        const problem = validateWorkingHours(raw);
        if (problem) fail(400, problem);
        hours = normalizeWorkingHours(raw);
      }
      business.workingHours = hours;
      business.updatedAt = iso(clock());
      const conflicts = { offers: [] as { id: string; title: string; reason: string }[], schedules: [] as { id: string; title: string; reason: string }[] };
      if (hours) {
        const now = clock();
        for (const offer of state.offers.filter((o) => o.businessId === business.id && !o.hidden && view(o).status === OfferStatus.ACTIVE && new Date(o.pickupEnd).getTime() > now)) {
          const reason = offerWindowHoursProblem(hours, business.timezone, new Date(offer.pickupStart).getTime(), new Date(offer.pickupEnd).getTime());
          if (reason) conflicts.offers.push({ id: offer.id, title: offer.title, reason });
        }
        for (const schedule of state.schedules.filter((s) => s.businessId === business.id && s.isActive)) {
          const reason = scheduleHoursProblem(hours, schedule);
          if (reason) conflicts.schedules.push({ id: schedule.id, title: schedule.title, reason });
        }
      }
      return { business, conflicts };
    },
    true
  );
  route("POST", /^\/business-applications$/, () => ({ id: uid("app") }), false);

  // --- offers
  route("GET", /^\/offers\/nearby$/, (req) => {
    materialize();
    const lat = num(req.query.get("lat"));
    const lng = num(req.query.get("lng"));
    const radius = num(req.query.get("radiusKm") ?? 10);
    const category = req.query.get("category");
    const minDiscount = req.query.get("minDiscount") ? num(req.query.get("minDiscount")) : 0;
    const now = clock();
    const result: NearbyOffer[] = [];
    for (const stored of state.offers) {
      if (stored.hidden) continue;
      const offer = view(stored);
      if (offer.status !== OfferStatus.ACTIVE || offer.quantityLeft <= 0 || new Date(offer.pickupEnd).getTime() <= now) continue;
      if (category && offer.category !== category) continue;
      if (offer.discountPercent < minDiscount) continue;
      const business = businessOf(offer.businessId);
      const distanceKm = haversineKm(lat, lng, business.lat, business.lng);
      if (Number.isFinite(radius) && distanceKm > radius) continue;
      result.push({ ...offer, businessName: business.name, businessAddress: business.address, businessLat: business.lat, businessLng: business.lng, businessLogoUrl: business.logoUrl ?? null, distanceKm });
    }
    return result.sort((a, b) => a.distanceKm - b.distanceKm);
  });
  route("GET", /^\/offers\/photo-presets$/, () => {
    const preset = (id: string, label: string, file: string, category: OfferCategory) => ({ id, label, url: `${options.assetBase}${file}`, category });
    return [
      preset("p1", "Бургер", "burger.jpg", OfferCategory.FOOD),
      preset("p2", "Паста", "carbonara.jpg", OfferCategory.FOOD),
      preset("p3", "Салат", "caesar-salad.jpg", OfferCategory.FOOD),
      preset("p4", "Пицца", "pizza-pepperoni.jpg", OfferCategory.FOOD),
      preset("p5", "Суши", "sushi-philadelphia.jpg", OfferCategory.FOOD),
      preset("p6", "Кофе", "cappuccino.jpg", OfferCategory.BAKERY),
      preset("p7", "Десерт", "cappuccino-shake.jpg", OfferCategory.BAKERY),
      preset("p8", "Стейк", "steak.jpg", OfferCategory.FOOD),
    ];
  });
  route(
    "POST",
    /^\/offers\/photo$/,
    async (req) => {
      const user = userOf(req.token);
      if (user.role === Role.USER) fail(403, "Недостаточно прав для этого действия");
      const file = req.files.photo ?? fail(400, "Файл не получен");
      if (!PHOTO_TYPES.includes(file.type)) fail(400, "Разрешены только изображения JPEG, PNG или WebP");
      if (file.size > 5 * 1024 * 1024) fail(400, "Файл больше 5 МБ");
      return { imageUrl: await fileToDataUrl(file) };
    },
    false
  );
  route("GET", /^\/offers$/, (req) => {
    materialize();
    const businessId = req.query.get("businessId");
    const category = req.query.get("category");
    const status = req.query.get("status");
    const page = Math.max(1, num(req.query.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, num(req.query.get("pageSize") ?? 20)));
    const all = state.offers
      .filter((offer) => !offer.hidden)
      .map(view)
      .filter((offer) => (!businessId || offer.businessId === businessId) && (!category || offer.category === category) && (status ? offer.status === status : businessId ? true : offer.status === OfferStatus.ACTIVE))
      .sort((a, b) => new Date(b.pickupEnd).getTime() - new Date(a.pickupEnd).getTime());
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
  });
  route("GET", /^\/offers\/([^/]+)$/, (_req, match) => view(findOffer(match[1])));
  route(
    "POST",
    /^\/offers$/,
    (req) => {
      const user = userOf(req.token);
      const body = record(req.body);
      const business = businessOf(str(body.businessId));
      assertOwnerOrAdmin(business, user);
      const title = str(body.title).trim();
      const category = str(body.category) as OfferCategory;
      const priceRub = num(body.originalPriceRub);
      const base = num(body.baseDiscountPercent);
      const quantity = num(body.quantityTotal);
      const weight = num(body.weightKg);
      if (title.length < 2) fail(400, "title must be longer than or equal to 2 characters");
      if (!Object.values(OfferCategory).includes(category)) fail(400, "category must be one of the following values: FOOD, BAKERY, FLOWERS, GROCERIES");
      if (!(priceRub > 0)) fail(400, "originalPriceRub must be a positive number");
      if (!(weight > 0)) fail(400, "weightKg must be a positive number");
      if (!Number.isInteger(quantity) || quantity < 1) fail(400, "quantityTotal must not be less than 1");
      if (!Number.isInteger(base) || base < DISCOUNT_RULES.MIN_BASE_PERCENT || base > DISCOUNT_RULES.MAX_PERCENT) fail(400, `baseDiscountPercent must not be less than ${DISCOUNT_RULES.MIN_BASE_PERCENT}`);
      const start = new Date(str(body.pickupStart)).getTime();
      const end = new Date(str(body.pickupEnd)).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) fail(400, "Некорректная дата окна самовывоза");
      assertWindow(business, start, end, { requireFuture: true, checkHours: true });
      const bestBefore = body.bestBefore ? new Date(str(body.bestBefore)).getTime() : null;
      assertFoodInfo({ category, ingredients: body.ingredients as string | undefined, allergens: (body.allergens as string[] | undefined) ?? null, bestBefore, pickupEnd: end }, true);
      const now = clock();
      const offer: StoredOffer = {
        id: uid("o-new"),
        businessId: business.id,
        title,
        description: str(body.description) || null,
        category,
        originalPrice: Math.round(priceRub * 100),
        discountedPrice: Math.round(priceRub * 100),
        discountPercent: base,
        baseDiscountPercent: base,
        discountMode: (body.discountMode as DiscountMode) === DiscountMode.FIXED ? DiscountMode.FIXED : DiscountMode.DYNAMIC,
        imageUrl: str(body.imageUrl) || null,
        quantityTotal: quantity,
        quantityLeft: quantity,
        weightKg: weight,
        pickupStart: iso(start),
        pickupEnd: iso(end),
        status: OfferStatus.ACTIVE,
        featured: false,
        ingredients: str(body.ingredients).trim() || null,
        allergens: Array.isArray(body.allergens) ? (body.allergens as string[]) : [],
        allergensDeclared: Array.isArray(body.allergens),
        bestBefore: bestBefore ? iso(bestBefore) : null,
        scheduleId: null,
        occurrenceDate: null,
        createdAt: iso(now),
        updatedAt: iso(now),
      };
      applyDiscount(offer);
      state.offers.push(offer);
      return offer;
    },
    true
  );
  route(
    "PATCH",
    /^\/offers\/([^/]+)$/,
    (req, match) => {
      const stored = findOffer(match[1]);
      const business = offerOwnerBusiness(stored);
      assertOwnerOrAdmin(business, userOf(req.token));
      const body = record(req.body);
      if (body.title !== undefined) stored.title = str(body.title).trim() || stored.title;
      if (body.description !== undefined) stored.description = str(body.description) || null;
      if (body.category !== undefined) stored.category = str(body.category) as OfferCategory;
      if (body.weightKg !== undefined && num(body.weightKg) > 0) stored.weightKg = num(body.weightKg);
      if (body.imageUrl !== undefined) stored.imageUrl = body.imageUrl === null ? null : str(body.imageUrl);
      if (body.discountMode !== undefined) stored.discountMode = body.discountMode as DiscountMode;
      if (body.baseDiscountPercent !== undefined) {
        const base = num(body.baseDiscountPercent);
        if (!Number.isInteger(base) || base < DISCOUNT_RULES.MIN_BASE_PERCENT || base > DISCOUNT_RULES.MAX_PERCENT) fail(400, `baseDiscountPercent must not be less than ${DISCOUNT_RULES.MIN_BASE_PERCENT}`);
        stored.baseDiscountPercent = base;
      }
      if (body.originalPriceRub !== undefined && num(body.originalPriceRub) > 0) stored.originalPrice = Math.round(num(body.originalPriceRub) * 100);
      const start = body.pickupStart ? new Date(str(body.pickupStart)).getTime() : new Date(stored.pickupStart).getTime();
      const end = body.pickupEnd ? new Date(str(body.pickupEnd)).getTime() : new Date(stored.pickupEnd).getTime();
      if (body.pickupStart || body.pickupEnd) {
        const moved = start !== new Date(stored.pickupStart).getTime() || end !== new Date(stored.pickupEnd).getTime();
        assertWindow(business, start, end, { requireFuture: !!body.pickupEnd, checkHours: moved });
        stored.pickupStart = iso(start);
        stored.pickupEnd = iso(end);
      }
      const touchesFood = body.ingredients !== undefined || body.allergens !== undefined || body.bestBefore !== undefined || body.category !== undefined;
      const bestBefore = body.bestBefore ? new Date(str(body.bestBefore)).getTime() : stored.bestBefore ? new Date(stored.bestBefore).getTime() : null;
      assertFoodInfo({ category: stored.category, ingredients: (body.ingredients as string | undefined) ?? stored.ingredients, allergens: (body.allergens as string[] | undefined) ?? (stored.allergensDeclared ? (stored.allergens ?? []) : null), bestBefore, pickupEnd: end }, touchesFood);
      if (body.ingredients !== undefined) stored.ingredients = str(body.ingredients).trim() || null;
      if (body.allergens !== undefined) {
        stored.allergens = body.allergens as string[];
        stored.allergensDeclared = true;
      }
      if (body.bestBefore !== undefined) stored.bestBefore = iso(bestBefore as number);
      if (body.quantityTotal !== undefined && num(body.quantityTotal) !== stored.quantityTotal) {
        const total = num(body.quantityTotal);
        if (!Number.isInteger(total) || total < 1) fail(400, "quantityTotal must not be less than 1");
        const sold = stored.quantityTotal - stored.quantityLeft;
        if (total < sold) fail(400, `Уже продано ${sold} — всего не может быть меньше`);
        stored.quantityLeft = total - sold;
        stored.quantityTotal = total;
        if (body.status === undefined) {
          if (stored.status === OfferStatus.SOLD_OUT && stored.quantityLeft > 0 && end > clock()) stored.status = OfferStatus.ACTIVE;
          else if (stored.status === OfferStatus.ACTIVE && stored.quantityLeft === 0) stored.status = OfferStatus.SOLD_OUT;
        }
      }
      if (body.status !== undefined) stored.status = str(body.status) as OfferStatus;
      applyDiscount(stored);
      stored.updatedAt = iso(clock());
      return view(stored);
    },
    true
  );
  route(
    "DELETE",
    /^\/offers\/([^/]+)$/,
    (req, match) => {
      const stored = findOffer(match[1]);
      assertOwnerOrAdmin(offerOwnerBusiness(stored), userOf(req.token));
      const orders = state.orders.filter((order) => order.offerId === stored.id);
      const inWork = orders.filter((order) => order.status === OrderStatus.CONFIRMED).length;
      if (inWork > 0) fail(409, `По офферу есть заказы в работе (${inWork}) — дождитесь выдачи или отмены, потом удаляйте`);
      if (orders.length > 0) fail(409, "По офферу уже были заказы — их история остаётся в отчётах, поэтому удалить его нельзя. Уберите оффер в архив.");
      state.offers = state.offers.filter((offer) => offer.id !== stored.id);
      let skippedDate: string | null = null;
      const schedule = stored.scheduleId ? state.schedules.find((s) => s.id === stored.scheduleId) : undefined;
      if (schedule && stored.occurrenceDate) {
        const today = zonedParts(clock(), schedule.timezone).date;
        if (stored.occurrenceDate >= today) {
          schedule.skipDates = [...new Set([...schedule.skipDates.filter((date) => date >= today), stored.occurrenceDate])].sort();
          skippedDate = stored.occurrenceDate;
        }
      }
      return { success: true, skippedDate };
    },
    true
  );

  // --- offer schedules
  const scheduleOf = (id: string, user: DemoUser): OfferSchedule => {
    const schedule = state.schedules.find((candidate) => candidate.id === id) ?? fail(404, "Шаблон не найден");
    assertOwnerOrAdmin(businessOf(schedule!.businessId), user);
    return schedule!;
  };
  route("GET", /^\/offer-schedules$/, (req) => {
    const business = businessOf(req.query.get("businessId") ?? "");
    assertOwnerOrAdmin(business, userOf(req.token));
    materialize();
    return state.schedules.filter((schedule) => schedule.businessId === business.id);
  });
  const parseScheduleInput = (body: Record<string, unknown>, base: Partial<OfferSchedule> = {}) => {
    const daysOfWeek = Array.isArray(body.daysOfWeek) ? [...new Set((body.daysOfWeek as number[]).map(Number))].sort((a, b) => a - b) : (base.daysOfWeek ?? []);
    return {
      daysOfWeek,
      pickupStartTime: str(body.pickupStartTime) || base.pickupStartTime || "",
      pickupEndTime: str(body.pickupEndTime) || base.pickupEndTime || "",
      publishLeadMinutes: body.publishLeadMinutes !== undefined ? num(body.publishLeadMinutes) : (base.publishLeadMinutes ?? SCHEDULE_RULES.DEFAULT_LEAD_MINUTES),
      timezone: str(body.timezone) || base.timezone || SCHEDULE_RULES.DEFAULT_TIMEZONE,
      startsOn: body.startsOn === undefined ? (base.startsOn ?? null) : ((body.startsOn as string | null) || null),
      endsOn: body.endsOn === undefined ? (base.endsOn ?? null) : ((body.endsOn as string | null) || null),
      skipDates: base.skipDates ?? [],
    };
  };
  route(
    "POST",
    /^\/offer-schedules$/,
    (req) => {
      const user = userOf(req.token);
      const body = record(req.body);
      const business = businessOf(str(body.businessId));
      assertOwnerOrAdmin(business, user);
      if (state.schedules.filter((s) => s.businessId === business.id).length >= SCHEDULE_RULES.MAX_PER_BUSINESS) fail(400, `Не больше ${SCHEDULE_RULES.MAX_PER_BUSINESS} шаблонов автовыкладки на заведение`);
      const timing = parseScheduleInput(body);
      const problem = validateScheduleTiming(timing);
      if (problem) fail(400, problem);
      const hours = business.workingHours ? normalizeWorkingHours(business.workingHours) : null;
      const hoursProblem = scheduleHoursProblem(hours, timing);
      if (hoursProblem) fail(400, hoursProblem);
      const category = str(body.category) as OfferCategory;
      const ingredients = str(body.ingredients).trim();
      if (requiresFoodInfo(category)) {
        if (ingredients.length < INGREDIENTS_MIN_LENGTH) fail(400, "Укажите состав: покупатель должен видеть его до оплаты");
        if (!Array.isArray(body.allergens)) fail(400, "Укажите аллергены или отметьте, что их нет");
        if (body.bestBeforeHoursAfterEnd === undefined || body.bestBeforeHoursAfterEnd === null) fail(400, "Укажите срок годности: на сколько часов после конца самовывоза продукт остаётся годным");
      }
      const now = iso(clock());
      const schedule: OfferSchedule = {
        id: uid("s"),
        businessId: business.id,
        title: str(body.title).trim(),
        description: str(body.description) || null,
        category,
        originalPrice: Math.round(num(body.originalPriceRub) * 100),
        baseDiscountPercent: num(body.baseDiscountPercent),
        discountMode: (body.discountMode as DiscountMode) === DiscountMode.FIXED ? DiscountMode.FIXED : DiscountMode.DYNAMIC,
        imageUrl: str(body.imageUrl) || null,
        quantityTotal: num(body.quantityTotal),
        weightKg: num(body.weightKg),
        ingredients: ingredients || null,
        allergens: Array.isArray(body.allergens) ? (body.allergens as string[]) : [],
        allergensDeclared: Array.isArray(body.allergens),
        bestBeforeHoursAfterEnd: body.bestBeforeHoursAfterEnd === undefined ? null : num(body.bestBeforeHoursAfterEnd),
        ...timing,
        isActive: body.isActive === undefined ? true : !!body.isActive,
        createdAt: now,
        updatedAt: now,
      };
      state.schedules.push(schedule);
      // Оффер, созданный вручную по этой же позиции, считается первой выкладкой: дубля в тот день не будет.
      const linked = body.linkOfferId ? state.offers.find((offer) => offer.id === str(body.linkOfferId) && offer.businessId === business.id && !offer.scheduleId) : undefined;
      if (linked) {
        const date = zonedParts(new Date(linked.pickupStart).getTime(), schedule.timezone).date;
        if (!state.offers.some((offer) => offer.scheduleId === schedule.id && offer.occurrenceDate === date)) {
          linked.scheduleId = schedule.id;
          linked.occurrenceDate = date;
        }
      }
      return schedule;
    },
    true
  );
  route(
    "PATCH",
    /^\/offer-schedules\/([^/]+)$/,
    (req, match) => {
      const schedule = scheduleOf(match[1], userOf(req.token));
      const body = record(req.body);
      const timing = parseScheduleInput(body, schedule);
      const problem = validateScheduleTiming(timing);
      if (problem) fail(400, problem);
      if (body.daysOfWeek || body.pickupStartTime || body.pickupEndTime) {
        const business = businessOf(schedule.businessId);
        const hoursProblem = scheduleHoursProblem(business.workingHours ? normalizeWorkingHours(business.workingHours) : null, timing);
        if (hoursProblem) fail(400, hoursProblem);
      }
      Object.assign(schedule, timing);
      if (body.title !== undefined) schedule.title = str(body.title).trim() || schedule.title;
      if (body.description !== undefined) schedule.description = str(body.description) || null;
      if (body.category !== undefined) schedule.category = str(body.category) as OfferCategory;
      if (body.originalPriceRub !== undefined) schedule.originalPrice = Math.round(num(body.originalPriceRub) * 100);
      if (body.baseDiscountPercent !== undefined) schedule.baseDiscountPercent = num(body.baseDiscountPercent);
      if (body.discountMode !== undefined) schedule.discountMode = body.discountMode as DiscountMode;
      if (body.quantityTotal !== undefined) schedule.quantityTotal = num(body.quantityTotal);
      if (body.weightKg !== undefined) schedule.weightKg = num(body.weightKg);
      if (body.imageUrl !== undefined) schedule.imageUrl = body.imageUrl === null ? null : str(body.imageUrl);
      if (body.ingredients !== undefined) schedule.ingredients = str(body.ingredients).trim() || null;
      if (body.allergens !== undefined) {
        schedule.allergens = body.allergens as string[];
        schedule.allergensDeclared = true;
      }
      if (body.bestBeforeHoursAfterEnd !== undefined) schedule.bestBeforeHoursAfterEnd = num(body.bestBeforeHoursAfterEnd);
      if (body.isActive !== undefined) schedule.isActive = !!body.isActive;
      schedule.updatedAt = iso(clock());
      return schedule;
    },
    true
  );
  route(
    "POST",
    /^\/offer-schedules\/([^/]+)\/skip$/,
    (req, match) => {
      const schedule = scheduleOf(match[1], userOf(req.token));
      const date = str(record(req.body).date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, "Дата — в формате ГГГГ-ММ-ДД");
      if (date < zonedParts(clock(), schedule.timezone).date) fail(400, "Нельзя пропустить прошедшую дату");
      schedule.skipDates = [...new Set([...schedule.skipDates, date])].sort();
      const published = state.offers.find((offer) => offer.scheduleId === schedule.id && offer.occurrenceDate === date);
      let archivedOfferId: string | null = null;
      let keptBecauseOrders = false;
      if (published && published.status === OfferStatus.ACTIVE) {
        if (published.quantityLeft === published.quantityTotal) {
          published.status = OfferStatus.ARCHIVED;
          archivedOfferId = published.id;
        } else keptBecauseOrders = true;
      }
      return { schedule, archivedOfferId, keptBecauseOrders };
    },
    true
  );
  route(
    "DELETE",
    /^\/offer-schedules\/([^/]+)\/skip\/([^/]+)$/,
    (req, match) => {
      const schedule = scheduleOf(match[1], userOf(req.token));
      schedule.skipDates = schedule.skipDates.filter((date) => date !== match[2]);
      return schedule;
    },
    true
  );
  route(
    "DELETE",
    /^\/offer-schedules\/([^/]+)$/,
    (req, match) => {
      const schedule = scheduleOf(match[1], userOf(req.token));
      state.schedules = state.schedules.filter((candidate) => candidate.id !== schedule.id);
      for (const offer of state.offers) if (offer.scheduleId === schedule.id) offer.scheduleId = null;
      return { success: true };
    },
    true
  );

  // --- orders
  const orderOf = (id: string, user: DemoUser): StoredOrder => {
    const order = state.orders.find((candidate) => candidate.id === id) ?? fail(404, "Заказ не найден");
    const business = state.businesses.find((candidate) => candidate.id === order!.businessId);
    const allowed = order!.userId === user.id || user.role === Role.ADMIN || (user.role === Role.BUSINESS && business?.ownerUserId === user.id);
    if (!allowed) fail(403, "Недостаточно прав для этого заказа");
    return order!;
  };
  route("GET", /^\/orders$/, (req) => {
    const user = userOf(req.token);
    let orders: StoredOrder[];
    if (user.role === Role.BUSINESS) {
      const ids = state.businesses.filter((business) => business.ownerUserId === user.id).map((business) => business.id);
      orders = state.orders.filter((order) => ids.includes(order.businessId));
    } else orders = state.orders.filter((order) => order.userId === user.id);
    return orders
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(({ history: _history, ...order }) => order);
  });
  route(
    "POST",
    /^\/orders$/,
    async (req) => {
      const user = userOf(req.token);
      if (user.role !== Role.USER) fail(403, "Недостаточно прав для этого действия");
      const body = record(req.body);
      const stored = findOffer(str(body.offerId));
      const quantity = num(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) fail(400, "quantity must not be less than 1");
      const offer = view(stored);
      if (offer.status !== OfferStatus.ACTIVE || new Date(offer.pickupEnd).getTime() <= clock()) fail(409, "Это предложение уже недоступно");
      if (offer.quantityLeft < quantity) fail(409, "Недостаточно остатка по этому офферу");
      stored.quantityLeft -= quantity;
      if (stored.quantityLeft === 0) stored.status = OfferStatus.SOLD_OUT;
      const order: StoredOrder = {
        id: uid("ord-u"),
        userId: user.id,
        offerId: stored.id,
        businessId: stored.businessId,
        quantity,
        totalPrice: offer.discountedPrice * quantity,
        platformFee: 0,
        status: OrderStatus.CONFIRMED,
        pickupCode: String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0"),
        createdAt: iso(clock()),
        acceptedAt: null,
      };
      state.orders.push(order);
      notify(user.id, NotificationType.ORDER_CONFIRMED, "Заказ оплачен", `${stored.title} — заберите самовывозом, код ${order.pickupCode}.`, { orderId: order.id });
      const { history: _history, ...plain } = order;
      return { ...plain, qrCodeDataUrl: await QRCode.toDataURL(JSON.stringify({ orderId: order.id, pickupCode: order.pickupCode }), { margin: 1, width: 280 }) };
    },
    true
  );
  route("GET", /^\/orders\/([^/]+)\/qrcode$/, async (req, match) => {
    const order = orderOf(match[1], userOf(req.token));
    return { qrCodeDataUrl: await QRCode.toDataURL(JSON.stringify({ orderId: order.id, pickupCode: order.pickupCode }), { margin: 1, width: 280 }) };
  });
  route("GET", /^\/orders\/([^/]+)$/, (req, match) => {
    const { history: _history, ...order } = orderOf(match[1], userOf(req.token));
    return order;
  });
  route(
    "PATCH",
    /^\/orders\/([^/]+)\/accept$/,
    (req, match) => {
      const user = userOf(req.token);
      if (user.role === Role.USER) fail(403, "Недостаточно прав для этого действия");
      const order = orderOf(match[1], user);
      if (order.status !== OrderStatus.CONFIRMED) fail(409, "Заказ уже нельзя принять");
      order.acceptedAt = iso(clock());
      notify(order.userId, NotificationType.ORDER_CONFIRMED, "Заведение приняло заказ", "Начинаем готовить — заберите в указанное время.", { orderId: order.id });
      const { history: _history, ...plain } = order;
      return plain;
    },
    true
  );
  route(
    "PATCH",
    /^\/orders\/([^/]+)\/complete$/,
    (req, match) => {
      const user = userOf(req.token);
      const order = orderOf(match[1], user);
      if (order.status !== OrderStatus.CONFIRMED) fail(409, "Заказ уже нельзя выдать");
      if (str(record(req.body).pickupCode) !== order.pickupCode) fail(400, "Неверный код самовывоза");
      order.status = OrderStatus.COMPLETED;
      order.completedAt = iso(clock());
      notify(order.userId, NotificationType.ORDER_COMPLETED, "Заказ выдан", "Подтвердите, что всё получили.", { orderId: order.id });
      const { history: _history, ...plain } = order;
      return plain;
    },
    true
  );
  route(
    "POST",
    /^\/orders\/([^/]+)\/receipt$/,
    (req, match) => {
      const user = userOf(req.token);
      const order = orderOf(match[1], user);
      if (order.userId !== user.id) fail(403, "Недостаточно прав для этого заказа");
      if (order.status !== OrderStatus.COMPLETED) fail(409, "Ответить можно после выдачи заказа");
      if (order.receiptConfirmedAt || order.receiptDisputedAt) fail(409, "Вы уже ответили по этому заказу");
      const body = record(req.body);
      if (body.received === true) order.receiptConfirmedAt = iso(clock());
      else {
        if (!Object.values(ReceiptDisputeReason).includes(body.reason as ReceiptDisputeReason)) fail(400, "Укажите причину");
        order.receiptDisputedAt = iso(clock());
        order.receiptDisputeReason = body.reason as ReceiptDisputeReason;
        order.receiptDisputeNote = str(body.note) || null;
      }
      const { history: _history, ...plain } = order;
      return plain;
    },
    true
  );

  // --- eco
  route("GET", /^\/eco\/me$/, (req) => {
    const user = userOf(req.token);
    const completed = state.orders.filter((order) => order.userId === user.id && order.status === OrderStatus.COMPLETED);
    const kg = completed.reduce((sum, order) => sum + (state.offers.find((offer) => offer.id === order.offerId)?.weightKg ?? 0) * order.quantity, 0);
    const points = completed.reduce((sum, order) => sum + Math.round((state.offers.find((offer) => offer.id === order.offerId)?.weightKg ?? 0) * order.quantity * ECO_POINTS_PER_KG), 0);
    return { totalPoints: points, totalWeightSavedKg: kg, ordersCompleted: completed.length, level: getEcoLevel(points), nextLevel: getNextEcoLevel(points) };
  });

  // --- notifications
  route("GET", /^\/notifications$/, (req) => {
    const user = userOf(req.token);
    const unreadOnly = req.query.get("unreadOnly") === "true";
    const page = Math.max(1, num(req.query.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, num(req.query.get("pageSize") ?? 20)));
    const all = state.notifications.filter((n) => n.userId === user.id && (!unreadOnly || !n.read));
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
  });
  route(
    "PATCH",
    /^\/notifications\/([^/]+)\/read$/,
    (req, match) => {
      const user = userOf(req.token);
      const item = state.notifications.find((n) => n.id === match[1] && n.userId === user.id) ?? fail(404, "Уведомление не найдено");
      item!.read = true;
      return item;
    },
    true
  );
  route("POST", /^\/notifications\/push-token$/, () => ({ success: true }));

  // --- платформенные разделы (админ платформы) в демо не нужны
  route("GET", /^\/platform\/.*$/, () => fail(403, "Раздел платформы недоступен в демо"));
  route("PATCH", /^\/platform\/.*$/, () => fail(403, "Раздел платформы недоступен в демо"));

  async function handle(req: DemoRequest): Promise<DemoResponse> {
    try {
      const match = routes
        .filter((candidate) => candidate.method === req.method)
        .map((candidate) => ({ candidate, m: req.path.match(candidate.pattern) }))
        .find((entry) => entry.m);
      if (!match || !match.m) return { status: 404, data: { statusCode: 404, message: `Cannot ${req.method} ${req.path}` } };
      const data = await match.candidate.handler(req, match.m);
      if (match.candidate.mutating) persist();
      return { status: req.method === "POST" ? 201 : 200, data };
    } catch (error) {
      if (error instanceof HttpError) return { status: error.status, data: { statusCode: error.status, message: error.message } };
      return { status: 500, data: { statusCode: 500, message: "Внутренняя ошибка демо" } };
    }
  }

  return {
    handle,
    /** Для тестов и кнопки «Сбросить демо». */
    reset() {
      resetSavedState(options);
      state = loadState(options, clock());
    },
    get state() {
      return state;
    },
  };
}

export type DemoApi = ReturnType<typeof createDemoApi>;
export const DEMO_BUYER_ID = BUYER_ID;
export const DEMO_PUSHKIN_ID = PUSHKIN_ID;
