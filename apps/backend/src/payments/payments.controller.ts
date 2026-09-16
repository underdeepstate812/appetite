import { createHmac, timingSafeEqual } from "node:crypto";
import { Body, Controller, ForbiddenException, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./payments.service";
import { PaymentWebhookDto } from "./dto/payment-webhook.dto";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService
  ) {}

  /**
   * У mock-провайдера charge() уже синхронно успешен, поэтому обычный сценарий
   * покупки этот эндпоинт не вызывает — он демонстрирует тот же контракт (подпись +
   * идемпотентное обновление статуса по externalId), который потребуется для
   * настоящего асинхронного вебхука Stripe/СБП при замене провайдера.
   */
  @HttpCode(HttpStatus.OK)
  @Post("webhook")
  handleWebhook(@Body() dto: PaymentWebhookDto, @Headers("x-webhook-signature") signature?: string) {
    this.verifySignature(dto, signature);
    return this.paymentsService.applyWebhookUpdate(dto.externalId, dto.status);
  }

  private verifySignature(dto: PaymentWebhookDto, signature: string | undefined) {
    const secret = this.config.getOrThrow<string>("PAYMENT_WEBHOOK_SECRET");
    const expected = createHmac("sha256", secret).update(`${dto.externalId}.${dto.status}`).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(signature ?? "", "hex");
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw new ForbiddenException("Неверная подпись вебхука");
    }
  }
}
