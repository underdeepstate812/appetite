import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: "/api/v1/test" }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
}

/** Так выглядит ошибка body-parser (http-errors), когда тело превышает лимит. */
function bodyParserError(status: number, type: string) {
  return Object.assign(new Error("request entity too large"), { status, statusCode: status, type, expose: true });
}

describe("AllExceptionsFilter", () => {
  it("HttpException отдаёт свой статус и сообщение", () => {
    const { status, body } = run(new NotFoundException("Заведение не найдено"));
    expect(status).toBe(404);
    expect(body).toMatchObject({ statusCode: 404, message: "Заведение не найдено", path: "/api/v1/test" });
  });

  it("сохраняет массив сообщений валидации", () => {
    const { status, body } = run(new BadRequestException(["lat must be a number"]));
    expect(status).toBe(400);
    expect(body.message).toEqual(["lat must be a number"]);
  });

  it("body-parser entity.too.large → 413, не 500", () => {
    const { status, body } = run(bodyParserError(413, "entity.too.large"));
    expect(status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(body.message).toBe("Слишком большой размер запроса");
  });

  it("берёт статус из statusCode, если status нет", () => {
    const { status } = run(Object.assign(new Error("unsupported"), { statusCode: 415 }));
    expect(status).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  });

  it("прочие 4xx от body-parser сохраняют статус с общим сообщением и не раскрывают текст ошибки", () => {
    const { status, body } = run(bodyParserError(400, "request.aborted"));
    expect(status).toBe(400);
    expect(body.message).toBe("Некорректный запрос");
  });

  it("не-4xx статус в поле status ошибки не пропускается", () => {
    expect(run(Object.assign(new Error("boom"), { status: 502 })).status).toBe(500);
    expect(run(Object.assign(new Error("boom"), { status: "413" })).status).toBe(500);
  });

  it("неизвестная ошибка → 500 без деталей", () => {
    const { status, body } = run(new Error("secret stack details"));
    expect(status).toBe(500);
    expect(body.message).toBe("Внутренняя ошибка сервера");
  });

  it("не-объект в throw → 500", () => {
    expect(run("oops").status).toBe(500);
    expect(run(null).status).toBe(500);
  });

  it("Prisma P2002 → 409", () => {
    const error = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["email"] },
    });
    const { status, body } = run(error);
    expect(status).toBe(409);
    expect(body.message).toContain("email");
  });
});
