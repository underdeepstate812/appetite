import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { BadRequestException, Body, Controller, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { UsersService } from "./users.service";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

const AVATAR_DIR = join(process.cwd(), "uploads", "avatars");
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch("me/location")
  updateLocation(@Body() dto: UpdateLocationDto, @CurrentUser() user: RequestUser) {
    return this.usersService.updateLocation(user.userId, dto);
  }

  /** Имя/email — телефон здесь принципиально нельзя менять, он нужен для входа и заказов. */
  @Patch("me")
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: RequestUser) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Post("me/avatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR, { recursive: true });
          cb(null, AVATAR_DIR);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${ALLOWED_MIME[file.mimetype] ?? ".jpg"}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME[file.mimetype]) {
          cb(new BadRequestException("Разрешены только JPEG/PNG/WebP"), false);
          return;
        }
        cb(null, true);
      },
    })
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    if (!file) throw new BadRequestException("Файл не получен");
    return this.usersService.updateAvatar(user.userId, `/uploads/avatars/${file.filename}`);
  }
}
