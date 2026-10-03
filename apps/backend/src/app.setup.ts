import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

export interface AppSetupOptions {
  apiPrefix: string;
  /** Каталог со статикой (аватарки), раздаётся по /uploads. */
  uploadsDir: string;
  /** Значение TRUST_PROXY: за reverse-proxy без него req.ip — адрес прокси, и лимиты по IP общие на всех. */
  trustProxy?: string;
}

/** "true"/"false" → boolean, "2" → число хопов, остальное ("loopback", CIDR) — как есть для Express. */
export function parseTrustProxy(value: string): boolean | number | string {
  if (value === "true") return true;
  if (value === "false") return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}

/** Общая HTTP-конфигурация приложения — используется и в main.ts, и в e2e-тестах. */
export function configureApp(app: NestExpressApplication, options: AppSetupOptions) {
  app.disable("x-powered-by");
  if (options.trustProxy) app.set("trust proxy", parseTrustProxy(options.trustProxy));

  // Аватарки грузятся из web-клиентов с других origin (mobile web, admin) — helmet по умолчанию
  // ставит Cross-Origin-Resource-Policy: same-origin, и браузер блокирует такие <img>.
  // helmet подключается до статики, чтобы заголовки получал и /uploads.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // Аватарки (users/me/avatar) — вне версионированного префикса, как и /health,
  // мобильный клиент строит URL прямо от origin backend: `${API_ORIGIN}/uploads/...`.
  app.useStaticAssets(options.uploadsDir, { prefix: "/uploads" });

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

  // /health живёт вне версионированного префикса — так его проверяет Docker healthcheck.
  app.setGlobalPrefix(options.apiPrefix, { exclude: [{ path: "health", method: RequestMethod.GET }] });
}
