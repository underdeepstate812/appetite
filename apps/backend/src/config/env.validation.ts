import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  BACKEND_PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default("api/v1"),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default("15m"),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_TTL: Joi.string().default("30d"),
  PLATFORM_COMMISSION_PERCENT: Joi.number().default(25),
  PICKUP_CODE_LENGTH: Joi.number().default(6),
  PAYMENT_PROVIDER: Joi.string().default("mock"),
  PAYMENT_WEBHOOK_SECRET: Joi.string().min(8).required(),
  DISCOUNT_CRON_EXPRESSION: Joi.string().default("*/15 * * * *"),
  EXPO_PUSH_MODE: Joi.string().default("mock"),
  SMS_PROVIDER: Joi.string().default("mock"),
})
  .unknown(true);
