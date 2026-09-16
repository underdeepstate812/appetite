import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Проверяет refresh-токен (стратегия 'jwt-refresh') и сверяет его хэш в БД. */
@Injectable()
export class JwtRefreshGuard extends AuthGuard("jwt-refresh") {}
