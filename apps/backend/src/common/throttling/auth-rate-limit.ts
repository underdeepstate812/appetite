import { applyDecorators, ExecutionContext, Injectable, UseGuards } from "@nestjs/common";
import { normalizeIp, Throttle, ThrottlerGuard, ThrottlerLimitDetail, ThrottlerOptions } from "@nestjs/throttler";

const WINDOW_MS = 60_000;

/** Троттлер «IP + идентификатор в теле» — брутфорс одного аккаунта; чужой IP его не блокирует. */
export const IDENTITY_THROTTLER = "identity";
/** Троттлер «только IP» — перебор многих аккаунтов (password spraying) с одного адреса. */
export const IP_THROTTLER = "ip";

/** Поле тела, по которому эндпоинт опознаёт «цель» попытки: login → identifier, register → email, otp → phone. */
const IDENTITY_FIELDS = ["identifier", "email", "phone"] as const;
const MAX_IDENTITY_LENGTH = 128;

export function identityTracker(req: Record<string, any>): string {
  const ip = normalizeIp(req.ip);
  const body = (req.body ?? {}) as Record<string, unknown>;
  for (const field of IDENTITY_FIELDS) {
    const value = body[field];
    if (typeof value === "string" && value.trim()) {
      return `${ip}|${value.trim().toLowerCase().slice(0, MAX_IDENTITY_LENGTH)}`;
    }
  }
  return ip;
}

/** Дефолты модуля; конкретные лимиты эндпоинтов задаёт @AuthRateLimit. */
export const AUTH_THROTTLERS: ThrottlerOptions[] = [
  { name: IDENTITY_THROTTLER, ttl: WINDOW_MS, limit: 10, getTracker: identityTracker },
  { name: IP_THROTTLER, ttl: WINDOW_MS, limit: 30 },
];

/** Именованные троттлеры отдают `Retry-After-<name>`; клиентам нужен стандартный `Retry-After`. */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    const { res } = this.getRequestResponse(context);
    res.header("Retry-After", detail.timeToBlockExpire);
    return super.throwThrottlingException(context, detail);
  }
}

export const RATE_LIMIT_MESSAGE = "Слишком много попыток. Попробуйте через минуту";

/**
 * Лимит запросов в минуту на публичный auth-эндпоинт: `identity` — на пару IP+идентификатор,
 * `ip` — на IP в целом. Guard вешается только на помеченные маршруты, остальное API не лимитируется.
 */
export const AuthRateLimit = (limits: { identity: number; ip: number }) =>
  applyDecorators(
    UseGuards(AuthThrottlerGuard),
    Throttle({ [IDENTITY_THROTTLER]: { limit: limits.identity }, [IP_THROTTLER]: { limit: limits.ip } })
  );
