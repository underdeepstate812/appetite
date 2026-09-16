import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsSchedulerService } from "./notifications-scheduler.service";
import { PUSH_PROVIDER } from "./push-provider.interface";
import { MockPushProvider } from "./providers/mock-push.provider";

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsSchedulerService,
    {
      provide: PUSH_PROVIDER,
      // Единственная реализация пока — mock. Настоящий expo-server-sdk добавится
      // веткой по EXPO_PUSH_MODE здесь, без изменений в NotificationsService.
      useFactory: (config: ConfigService) => {
        const mode = config.get<string>("EXPO_PUSH_MODE", "mock");
        if (mode !== "mock") {
          throw new Error(`Push-режим "${mode}" ещё не реализован (только "mock")`);
        }
        return new MockPushProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
