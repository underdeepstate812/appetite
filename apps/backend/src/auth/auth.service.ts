import { randomInt } from "node:crypto";
import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { Role, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { toPublicUser } from "../common/utils/public-user";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { SMS_PROVIDER, SmsProvider } from "./sms/sms-provider.interface";

const PASSWORD_SALT_ROUNDS = 10;
const OTP_TTL_SECONDS = 300;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** Окно, в течение которого подтверждённый телефон можно приложить к регистрации. */
const OTP_VERIFIED_TTL_SECONDS = 600;

function otpCodeKey(phone: string) {
  return `otp:code:${phone}`;
}
function otpCooldownKey(phone: string) {
  return `otp:cooldown:${phone}`;
}
function otpVerifiedKey(phone: string) {
  return `otp:verified:${phone}`;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider
  ) {}

  /** Код действителен OTP_TTL_SECONDS, повторная отправка — не чаще раза в OTP_RESEND_COOLDOWN_SECONDS. */
  async requestOtp(dto: RequestOtpDto) {
    const onCooldown = await this.redis.get(otpCooldownKey(dto.phone));
    if (onCooldown) {
      throw new ConflictException("Код уже отправлен, попробуй через минуту");
    }
    const code = randomInt(100000, 1000000).toString();
    await this.redis.set(otpCodeKey(dto.phone), code, "EX", OTP_TTL_SECONDS);
    await this.redis.set(otpCooldownKey(dto.phone), "1", "EX", OTP_RESEND_COOLDOWN_SECONDS);
    await this.sms.send(dto.phone, `Код подтверждения Appetite: ${code}`);
    return { success: true };
  }

  /**
   * Код одноразовый — удаляется сразу после успешной проверки. Отдельный
   * "verified"-ключ с более коротким TTL — доказательство для register(), что именно
   * этот телефон только что подтверждён (иначе register принял бы любой phone без проверки).
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const storedCode = await this.redis.get(otpCodeKey(dto.phone));
    if (!storedCode || storedCode !== dto.code) {
      throw new ConflictException("Неверный или истёкший код");
    }
    await this.redis.del(otpCodeKey(dto.phone));
    await this.redis.set(otpVerifiedKey(dto.phone), "1", "EX", OTP_VERIFIED_TTL_SECONDS);
    return { verified: true };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Пользователь с таким email уже зарегистрирован");
    }
    if (dto.phone) {
      const verified = await this.redis.get(otpVerifiedKey(dto.phone));
      if (!verified) {
        throw new ConflictException("Телефон не подтверждён — запроси код ещё раз");
      }
      await this.redis.del(otpVerifiedKey(dto.phone));
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        role: Role.USER,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return { user: toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim();
    const isEmail = identifier.includes("@");
    const user = isEmail
      ? await this.prisma.user.findUnique({ where: { email: identifier } })
      : await this.prisma.user.findUnique({ where: { phone: identifier } });
    if (!user) {
      throw new UnauthorizedException("Неверный email/телефон или пароль");
    }
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("Неверный email/телефон или пароль");
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return { user: toPublicUser(user), ...tokens };
  }

  async refresh(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return toPublicUser(user);
  }

  /** Используется JwtRefreshStrategy — сверяет присланный refresh-токен с хэшем в БД. */
  async validateRefreshToken(userId: string, refreshToken: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException("Сессия недействительна, войдите заново");
    }
    const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!valid) {
      throw new UnauthorizedException("Сессия недействительна, войдите заново");
    }
    return user;
  }

  private async issueTokens(userId: string, email: string, role: Role): Promise<AuthTokens> {
    const payload = { sub: userId, email, role };
    // expiresIn у jsonwebtoken типизирован как литерал вида "15m" (пакет `ms`), а не общий
    // string — значение приходит из env рантаймом, поэтому типобезопасно сузить его нельзя.
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m") as JwtSignOptions["expiresIn"],
      }),
      this.jwt.signAsync(
        { sub: userId },
        {
          secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
          expiresIn: this.config.get<string>("JWT_REFRESH_TTL", "30d") as JwtSignOptions["expiresIn"],
        }
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, PASSWORD_SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash } });
  }
}
