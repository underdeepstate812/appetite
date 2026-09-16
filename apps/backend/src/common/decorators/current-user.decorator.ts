import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedRequest, RequestUser } from "../interfaces/authenticated-request.interface";

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
