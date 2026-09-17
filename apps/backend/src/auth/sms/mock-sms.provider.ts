import { Injectable, Logger } from "@nestjs/common";
import { SmsProvider } from "./sms-provider.interface";

/** Мок для dev/беты: вместо реальной отправки SMS — структурированный лог с кодом. */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";
  private readonly logger = new Logger(MockSmsProvider.name);

  async send(phone: string, message: string): Promise<void> {
    this.logger.log(`mock sms -> ${phone}: "${message}"`);
  }
}
