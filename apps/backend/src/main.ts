import "./load-env";

import { join } from "path";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { uploadsRoot } from "./offers/offer-photo";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  configureApp(app, {
    apiPrefix: config.get<string>("API_PREFIX", "api/v1"),
    uploadsDir: uploadsRoot(),
    presetsDir: join(process.cwd(), "assets", "offer-presets"),
    trustProxy: config.get<string>("TRUST_PROXY"),
  });

  const port = config.get<number>("BACKEND_PORT", 3000);
  await app.listen(port);
}

bootstrap();
