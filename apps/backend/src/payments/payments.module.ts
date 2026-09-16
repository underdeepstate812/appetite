import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { PAYMENT_PROVIDER } from "./payment-provider.interface";
import { MockPaymentProvider } from "./providers/mock-payment.provider";

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      // Единственная реализация пока — mock. Реальный провайдер (Stripe/СБП) добавится
      // веткой по PAYMENT_PROVIDER здесь, без изменений в PaymentsService/OrdersService.
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>("PAYMENT_PROVIDER", "mock");
        if (provider !== "mock") {
          throw new Error(`Платёжный провайдер "${provider}" ещё не реализован (только "mock")`);
        }
        return new MockPaymentProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
