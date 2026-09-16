import "./load-env";

import { NestFactory } from "@nestjs/core";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Бета без продовой отдельной инфры: web-клиенты (mobile web, ШАГ 10 admin) обращаются
  // с других портов/хостов — открываем CORS широко, токены передаются заголовком, не cookie.
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = app.get(ConfigService);
  const prefix = config.get<string>("API_PREFIX", "api/v1");
  // /health живёт вне версионированного префикса — так его проверяет Docker healthcheck.
  app.setGlobalPrefix(prefix, { exclude: [{ path: "health", method: RequestMethod.GET }] });

  const port = config.get<number>("BACKEND_PORT", 3000);
  await app.listen(port);
}

bootstrap();
