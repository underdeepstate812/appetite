import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Проверяет access-токен (стратегия 'jwt'). */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
