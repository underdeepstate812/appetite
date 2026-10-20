import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AUTH_THROTTLERS, RATE_LIMIT_MESSAGE } from "../common/throttling/auth-rate-limit";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAccessStrategy } from "./strategies/jwt-access.strategy";
import { JwtRefreshStrategy } from "./strategies/jwt-refresh.strategy";
import { SMS_PROVIDER } from "./sms/sms-provider.interface";
import { MockSmsProvider } from "./sms/mock-sms.provider";

@Module({
  // Секреты передаются явно на каждый sign/verify в AuthService и стратегиях
  // (access и refresh подписываются разными ключами) — JwtModule регистрируем без дефолтов.
  imports: [
    PassportModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot({ throttlers: AUTH_THROTTLERS, errorMessage: RATE_LIMIT_MESSAGE }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    {
      provide: SMS_PROVIDER,
      // Единственная реализация пока — mock, тот же паттерн, что PAYMENT_PROVIDER/PUSH_PROVIDER.
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>("SMS_PROVIDER", "mock");
        if (provider !== "mock") {
          throw new Error(`SMS-провайдер "${provider}" ещё не реализован (только "mock")`);
        }
        return new MockSmsProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
