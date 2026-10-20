import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BusinessStatus, DiscountMode, OfferSchedule, OfferStatus, Prisma, Role } from "@prisma/client";
import {
  SCHEDULE_RULES,
  bestBeforeFor,
  currentDiscountPercent,
  dueOccurrences,
  isDateString,
  normalizeWorkingHours,
  occurrenceOn,
  offerWindowHoursProblem,
  requiresFoodInfo,
  scheduleHoursProblem,
  validateScheduleTiming,
  zonedParts,
  type OfferCategory as SharedCategory,
  type Occurrence,
} from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";
import { assertFoodInfo } from "../offers/food-info";
import { CreateOfferScheduleDto, UpdateOfferScheduleDto } from "./dto/offer-schedule.dto";

export interface MaterializeResult {
  created: number;
  checked: number;
  /** Выкладки, которые не вошли в часы работы заведения (часы изменили позже): не создаём, а не нарушаем правило закрытия. */
  skippedOutsideHours: number;
}

@Injectable()
export class OfferSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, requester: RequestUser) {
    const business = await this.getBusiness(businessId);
    this.assertOwnerOrAdmin(business.ownerUserId, requester);
    return this.prisma.offerSchedule.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } });
  }

  async create(dto: CreateOfferScheduleDto, requester: RequestUser) {
    const business = await this.getBusiness(dto.businessId);
    this.assertOwnerOrAdmin(business.ownerUserId, requester);

    const count = await this.prisma.offerSchedule.count({ where: { businessId: dto.businessId } });
    if (count >= SCHEDULE_RULES.MAX_PER_BUSINESS) {
      throw new BadRequestException(`Не больше ${SCHEDULE_RULES.MAX_PER_BUSINESS} шаблонов автовыкладки на заведение`);
    }

    const timing = {
      daysOfWeek: [...new Set(dto.daysOfWeek)].sort((a, b) => a - b),
      pickupStartTime: dto.pickupStartTime,
      pickupEndTime: dto.pickupEndTime,
      publishLeadMinutes: dto.publishLeadMinutes ?? SCHEDULE_RULES.DEFAULT_LEAD_MINUTES,
      timezone: dto.timezone ?? SCHEDULE_RULES.DEFAULT_TIMEZONE,
      startsOn: dto.startsOn ?? null,
      endsOn: dto.endsOn ?? null,
      skipDates: [] as string[],
    };
    // Дубли в массиве дней не прощаем молча: «Пн, Пн» — скорее всего ошибка клиента.
    if (timing.daysOfWeek.length !== dto.daysOfWeek.length) throw new BadRequestException("Дни недели: числа от 1 (пн) до 7 (вс), без повторов");
    this.assertTiming(timing);
    this.assertHours(business, timing);
    this.assertContent(dto.category, dto.ingredients, dto.allergens, dto.bestBeforeHoursAfterEnd);

    const schedule = await this.prisma.offerSchedule.create({
      data: {
        businessId: dto.businessId,
        title: dto.title.trim(),
        description: dto.description,
        category: dto.category,
        originalPrice: Math.round(dto.originalPriceRub * 100),
        baseDiscountPercent: dto.baseDiscountPercent,
        discountMode: dto.discountMode ?? DiscountMode.DYNAMIC,
        imageUrl: dto.imageUrl ?? null,
        quantityTotal: dto.quantityTotal,
        weightKg: dto.weightKg,
        ingredients: dto.ingredients?.trim() || null,
        allergens: dto.allergens ?? [],
        allergensDeclared: dto.allergens !== undefined,
        bestBeforeHoursAfterEnd: dto.bestBeforeHoursAfterEnd ?? null,
        ...timing,
        isActive: dto.isActive ?? true,
      },
    });

    if (dto.linkOfferId) await this.linkFirstOffer(schedule, dto.linkOfferId);
    return schedule;
  }

  async update(id: string, dto: UpdateOfferScheduleDto, requester: RequestUser) {
    const schedule = await this.getOwned(id, requester);

    const daysOfWeek = dto.daysOfWeek ? [...new Set(dto.daysOfWeek)].sort((a, b) => a - b) : schedule.daysOfWeek;
    if (dto.daysOfWeek && daysOfWeek.length !== dto.daysOfWeek.length) throw new BadRequestException("Дни недели: числа от 1 (пн) до 7 (вс), без повторов");
    const timing = {
      daysOfWeek,
      pickupStartTime: dto.pickupStartTime ?? schedule.pickupStartTime,
      pickupEndTime: dto.pickupEndTime ?? schedule.pickupEndTime,
      publishLeadMinutes: dto.publishLeadMinutes ?? schedule.publishLeadMinutes,
      timezone: dto.timezone ?? schedule.timezone,
      startsOn: dto.startsOn === undefined ? schedule.startsOn : dto.startsOn,
      endsOn: dto.endsOn === undefined ? schedule.endsOn : dto.endsOn,
      skipDates: schedule.skipDates,
    };
    this.assertTiming(timing);
    // Часы работы проверяем, только когда правят само расписание: переименовать/поменять цену шаблона, переставшего влезать в часы, можно.
    if (dto.daysOfWeek || dto.pickupStartTime || dto.pickupEndTime) this.assertHours(schedule.business, timing);

    const category = dto.category ?? schedule.category;
    const touchesContent = dto.category !== undefined || dto.ingredients !== undefined || dto.allergens !== undefined || dto.bestBeforeHoursAfterEnd !== undefined;
    if (touchesContent) {
      this.assertContent(
        category,
        dto.ingredients ?? schedule.ingredients,
        dto.allergens ?? (schedule.allergensDeclared ? schedule.allergens : undefined),
        dto.bestBeforeHoursAfterEnd ?? schedule.bestBeforeHoursAfterEnd ?? undefined
      );
    }

    const data: Prisma.OfferScheduleUpdateInput = {
      title: dto.title?.trim(),
      description: dto.description,
      category: dto.category,
      baseDiscountPercent: dto.baseDiscountPercent,
      discountMode: dto.discountMode,
      weightKg: dto.weightKg,
      quantityTotal: dto.quantityTotal,
      imageUrl: dto.imageUrl,
      bestBeforeHoursAfterEnd: dto.bestBeforeHoursAfterEnd,
      isActive: dto.isActive,
      daysOfWeek: timing.daysOfWeek,
      pickupStartTime: timing.pickupStartTime,
      pickupEndTime: timing.pickupEndTime,
      publishLeadMinutes: timing.publishLeadMinutes,
      timezone: timing.timezone,
      startsOn: timing.startsOn,
      endsOn: timing.endsOn,
    };
    if (dto.originalPriceRub !== undefined) data.originalPrice = Math.round(dto.originalPriceRub * 100);
    if (dto.ingredients !== undefined) data.ingredients = dto.ingredients.trim() || null;
    if (dto.allergens !== undefined) {
      data.allergens = dto.allergens;
      data.allergensDeclared = true;
    }
    // Правка шаблона действует на БУДУЩИЕ выкладки: уже выложенные офферы живут сами (их правят как обычные).
    return this.prisma.offerSchedule.update({ where: { id }, data });
  }

  /**
   * Пропустить выкладку на дату (праздник, выходной). Оффер на эту дату, если уже выложен и по нему ещё никто не заказывал,
   * снимается в архив; если заказы есть — остаётся (нельзя отобрать оплаченное), и мы говорим об этом.
   */
  async skip(id: string, date: string, requester: RequestUser) {
    const schedule = await this.getOwned(id, requester);
    if (!isDateString(date)) throw new BadRequestException("Дата — в формате ГГГГ-ММ-ДД");
    const today = zonedParts(Date.now(), schedule.timezone).date;
    if (date < today) throw new BadRequestException("Нельзя пропустить прошедшую дату");
    const skipDates = [...new Set([...schedule.skipDates, date])].sort();
    if (skipDates.length > SCHEDULE_RULES.MAX_SKIP_DATES) throw new BadRequestException(`Не больше ${SCHEDULE_RULES.MAX_SKIP_DATES} пропусков`);

    const published = await this.prisma.offer.findUnique({ where: { scheduleId_occurrenceDate: { scheduleId: id, occurrenceDate: date } } });
    let archived = false;
    let keptBecauseOrders = false;
    if (published && published.status === OfferStatus.ACTIVE) {
      if (published.quantityLeft === published.quantityTotal) {
        await this.prisma.offer.update({ where: { id: published.id }, data: { status: OfferStatus.ARCHIVED } });
        archived = true;
      } else {
        keptBecauseOrders = true;
      }
    }
    const updated = await this.prisma.offerSchedule.update({ where: { id }, data: { skipDates } });
    return { schedule: updated, archivedOfferId: archived ? published!.id : null, keptBecauseOrders };
  }

  async unskip(id: string, date: string, requester: RequestUser) {
    const schedule = await this.getOwned(id, requester);
    return this.prisma.offerSchedule.update({ where: { id }, data: { skipDates: schedule.skipDates.filter((d) => d !== date) } });
  }

  async remove(id: string, requester: RequestUser) {
    await this.getOwned(id, requester);
    // Уже выложенные офферы остаются (scheduleId → null по onDelete: SetNull): удалить шаблон ≠ отозвать то, что в продаже.
    await this.prisma.offerSchedule.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Выкладывает офферы, время которых пришло. Идемпотентно: уникальный индекс (scheduleId, occurrenceDate) не даёт создать
   * дубль ни при повторном запуске, ни при двух экземплярах сервиса. Заведение не ACTIVE (не прошло модерацию, заблокировано)
   * не выкладывается.
   */
  async materialize(now: number = Date.now()): Promise<MaterializeResult> {
    const schedules = await this.prisma.offerSchedule.findMany({
      where: { isActive: true, business: { status: BusinessStatus.ACTIVE } },
      include: { business: { select: { workingHours: true, timezone: true } } },
    });
    let created = 0;
    let skippedOutsideHours = 0;
    for (const { business, ...schedule } of schedules) {
      const hours = business.workingHours ? normalizeWorkingHours(business.workingHours) : null;
      for (const occurrence of dueOccurrences(schedule, now)) {
        if (offerWindowHoursProblem(hours, business.timezone, occurrence.pickupStart.getTime(), occurrence.pickupEnd.getTime())) {
          skippedOutsideHours += 1;
          continue;
        }
        if (await this.createOffer(schedule, occurrence, now)) created += 1;
      }
    }
    return { created, checked: schedules.length, skippedOutsideHours };
  }

  private async createOffer(schedule: OfferSchedule, occurrence: Occurrence, now: number): Promise<boolean> {
    const exists = await this.prisma.offer.findUnique({ where: { scheduleId_occurrenceDate: { scheduleId: schedule.id, occurrenceDate: occurrence.date } }, select: { id: true } });
    if (exists) return false;

    const hoursToEnd = (occurrence.pickupEnd.getTime() - now) / 3_600_000;
    const discountPercent = currentDiscountPercent(schedule.discountMode, schedule.baseDiscountPercent, hoursToEnd);
    try {
      await this.prisma.offer.create({
        data: {
          businessId: schedule.businessId,
          scheduleId: schedule.id,
          occurrenceDate: occurrence.date,
          title: schedule.title,
          description: schedule.description,
          category: schedule.category,
          originalPrice: schedule.originalPrice,
          discountMode: schedule.discountMode,
          baseDiscountPercent: schedule.baseDiscountPercent,
          discountPercent,
          discountedPrice: Math.round((schedule.originalPrice * (100 - discountPercent)) / 100),
          imageUrl: schedule.imageUrl,
          quantityTotal: schedule.quantityTotal,
          quantityLeft: schedule.quantityTotal,
          weightKg: schedule.weightKg,
          pickupStart: occurrence.pickupStart,
          pickupEnd: occurrence.pickupEnd,
          status: OfferStatus.ACTIVE,
          ingredients: schedule.ingredients,
          allergens: schedule.allergens,
          allergensDeclared: schedule.allergensDeclared,
          bestBefore: bestBeforeFor(occurrence.pickupEnd, schedule.bestBeforeHoursAfterEnd, schedule.category as SharedCategory),
        },
      });
      return true;
    } catch (error) {
      // Параллельный экземпляр успел раньше — это не ошибка, оффер на эту дату уже есть.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
      throw error;
    }
  }

  private async linkFirstOffer(schedule: OfferSchedule, offerId: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer || offer.businessId !== schedule.businessId || offer.scheduleId) return;
    const date = zonedParts(offer.pickupStart, schedule.timezone).date;
    // Связываем, только если эта дата и вправду выкладка шаблона (день недели и границы) — иначе оффер остаётся разовым.
    if (!occurrenceOn(schedule, date)) return;
    await this.prisma.offer.update({ where: { id: offer.id }, data: { scheduleId: schedule.id, occurrenceDate: date } }).catch((error) => {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    });
  }

  private assertHours(business: { workingHours: unknown; timezone?: string }, timing: { daysOfWeek: number[]; pickupStartTime: string; pickupEndTime: string; timezone: string }) {
    // Часы работы записаны в поясе заведения; время шаблона сравниваем с ними «стенными часами», поэтому пояса обязаны совпадать.
    if (business.workingHours && business.timezone && timing.timezone !== business.timezone) {
      throw new BadRequestException(`Время шаблона задаётся по часовому поясу заведения (${business.timezone}), а не ${timing.timezone}`);
    }
    const problem = scheduleHoursProblem(business.workingHours ? normalizeWorkingHours(business.workingHours) : null, timing);
    if (problem) throw new BadRequestException(problem);
  }

  private assertTiming(timing: Parameters<typeof validateScheduleTiming>[0]) {
    const error = validateScheduleTiming(timing);
    if (error) throw new BadRequestException(error);
  }

  /** Состав/аллергены/срок годности — те же требования, что к обычному офферу (для еды обязательны): шаблон не должен выкладывать то, что оффер бы не принял. */
  private assertContent(category: string, ingredients?: string | null, allergens?: string[] | null, bestBeforeHours?: number | null) {
    assertFoodInfo(
      { category, ingredients, allergens, bestBefore: new Date(0), pickupEnd: new Date(0) },
      true
    );
    if (requiresFoodInfo(category as SharedCategory) && (bestBeforeHours === undefined || bestBeforeHours === null)) {
      throw new BadRequestException("Укажите срок годности: на сколько часов после конца самовывоза продукт остаётся годным");
    }
  }

  private async getBusiness(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException("Заведение не найдено");
    return business;
  }

  private async getOwned(id: string, requester: RequestUser) {
    const schedule = await this.prisma.offerSchedule.findUnique({ where: { id }, include: { business: true } });
    if (!schedule) throw new NotFoundException("Шаблон не найден");
    this.assertOwnerOrAdmin(schedule.business.ownerUserId, requester);
    return schedule;
  }

  private assertOwnerOrAdmin(ownerUserId: string, requester: RequestUser) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.BUSINESS && requester.userId === ownerUserId) return;
    throw new ForbiddenException("Недостаточно прав для этого шаблона");
  }
}
