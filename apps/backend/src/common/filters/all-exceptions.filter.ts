import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";

interface ErrorBody {
  status: number;
  message: string | string[];
}

const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  [HttpStatus.PAYLOAD_TOO_LARGE]: "Слишком большой размер запроса",
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: "Неподдерживаемый формат запроса",
};

/**
 * Ошибки body-parser/http-errors (например 413 entity.too.large) — не HttpException,
 * но несут собственный 4xx-статус: без этого клиентская ошибка превращается в 500.
 */
function clientErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== "object" || exception === null) return undefined;
  const { status, statusCode } = exception as { status?: unknown; statusCode?: unknown };
  const code = typeof status === "number" ? status : statusCode;
  return typeof code === "number" && code >= 400 && code < 500 ? code : undefined;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      return { status: exception.getStatus(), message };
    }

    const clientStatus = clientErrorStatus(exception);
    if (clientStatus !== undefined) {
      return { status: clientStatus, message: CLIENT_ERROR_MESSAGES[clientStatus] ?? "Некорректный запрос" };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        const target = (exception.meta?.target as string[] | undefined)?.join(", ");
        return {
          status: HttpStatus.CONFLICT,
          message: `Запись с такими данными уже существует${target ? ` (${target})` : ""}`,
        };
      }
      if (exception.code === "P2025") {
        return { status: HttpStatus.NOT_FOUND, message: "Запись не найдена" };
      }
      return { status: HttpStatus.BAD_REQUEST, message: "Ошибка базы данных" };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Внутренняя ошибка сервера" };
  }
}
