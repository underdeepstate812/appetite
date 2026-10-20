import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsPositive, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { DiscountMode, OfferCategory } from "@prisma/client";
import { DISCOUNT_RULES, INGREDIENTS_MAX_LENGTH, OFFER_ALLERGENS, SCHEDULE_RULES } from "@apetite/shared";
import { IsOfferImageUrl } from "../../offers/dto/is-offer-image-url";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Шаблон автовыкладки. Форматы и согласованность расписания (дни, окно, границы, часовой пояс) проверяет
 * validateScheduleTiming из @apetite/shared — тот же код, что в форме кабинета; здесь — типы полей.
 */
export class CreateOfferScheduleDto {
  @IsUUID()
  businessId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(OfferCategory)
  category!: OfferCategory;

  /** В рублях — сервис переводит в копейки. */
  @IsPositive()
  originalPriceRub!: number;

  @IsInt()
  @Min(DISCOUNT_RULES.MIN_BASE_PERCENT)
  @Max(DISCOUNT_RULES.MAX_PERCENT)
  baseDiscountPercent!: number;

  @IsOptional()
  @IsEnum(DiscountMode)
  discountMode?: DiscountMode;

  @IsPositive()
  weightKg!: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantityTotal!: number;

  @IsOptional()
  @IsOfferImageUrl()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(INGREDIENTS_MAX_LENGTH)
  ingredients?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(OFFER_ALLERGENS, { each: true })
  allergens?: string[];

  /** Срок годности каждого выложенного оффера = конец самовывоза + столько часов (для еды обязателен). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 30)
  bestBeforeHoursAfterEnd?: number;

  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  daysOfWeek!: number[];

  @Matches(TIME)
  pickupStartTime!: string;

  @Matches(TIME)
  pickupEndTime!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(SCHEDULE_RULES.MAX_LEAD_MINUTES)
  publishLeadMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @Matches(DATE)
  startsOn?: string | null;

  @IsOptional()
  @Matches(DATE)
  endsOn?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Оффер, только что созданный вручную по этой же позиции: связываем его с первой выкладкой, чтобы шедулер не выложил дубль в тот же день. */
  @IsOptional()
  @IsUUID()
  linkOfferId?: string;
}

export class UpdateOfferScheduleDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(OfferCategory) category?: OfferCategory;
  @IsOptional() @IsPositive() originalPriceRub?: number;
  @IsOptional() @IsInt() @Min(DISCOUNT_RULES.MIN_BASE_PERCENT) @Max(DISCOUNT_RULES.MAX_PERCENT) baseDiscountPercent?: number;
  @IsOptional() @IsEnum(DiscountMode) discountMode?: DiscountMode;
  @IsOptional() @IsPositive() weightKg?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) quantityTotal?: number;
  @IsOptional() @IsOfferImageUrl() imageUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(INGREDIENTS_MAX_LENGTH) ingredients?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(OFFER_ALLERGENS, { each: true }) allergens?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(24 * 30) bestBeforeHoursAfterEnd?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) daysOfWeek?: number[];
  @IsOptional() @Matches(TIME) pickupStartTime?: string;
  @IsOptional() @Matches(TIME) pickupEndTime?: string;
  @IsOptional() @IsInt() @Min(0) @Max(SCHEDULE_RULES.MAX_LEAD_MINUTES) publishLeadMinutes?: number;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  /** null — снять границу. */
  @IsOptional() @Matches(DATE) startsOn?: string | null;
  @IsOptional() @Matches(DATE) endsOn?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SkipDateDto {
  @Matches(DATE)
  date!: string;
}
