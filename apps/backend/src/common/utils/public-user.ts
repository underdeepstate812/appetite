import { User } from "@prisma/client";

/** Убирает секреты (passwordHash/refreshTokenHash) перед отдачей User наружу через API. */
export function toPublicUser(user: User) {
  const { passwordHash: _passwordHash, refreshTokenHash: _refreshTokenHash, ...publicUser } = user;
  return publicUser;
}
