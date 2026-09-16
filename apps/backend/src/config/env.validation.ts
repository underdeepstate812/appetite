import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  BACKEND_PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default("api/v1"),
  DATABASE_URL: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default("15m"),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_TTL: Joi.string().default("30d"),
  PLATFORM_COMMISSION_PERCENT: Joi.number().default(25),
  PICKUP_CODE_LENGTH: Joi.number().default(6),
})
  // Остальные переменные (Redis, платежи, push и т.д.) появятся в ШАГ 5/6 — не валидируем их здесь заранее.
  .unknown(true);
