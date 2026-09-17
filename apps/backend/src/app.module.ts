import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { envValidationSchema } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { OffersModule } from "./offers/offers.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { UsersModule } from "./users/users.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { EcoModule } from "./eco/eco.module";
import { PlatformModule } from "./platform/platform.module";
import { AppController } from "./app.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        transport:
          process.env.NODE_ENV === "production"
            ? undefined
            : { target: "pino-pretty", options: { singleLine: true, colorize: true } },
        redact: ["req.headers.authorization"],
      },
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    BusinessesModule,
    OffersModule,
    OrdersModule,
    PaymentsModule,
    SchedulerModule,
    UsersModule,
    NotificationsModule,
    EcoModule,
    PlatformModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
