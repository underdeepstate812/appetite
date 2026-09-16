import { Body, Controller, Patch, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch("me/location")
  updateLocation(@Body() dto: UpdateLocationDto, @CurrentUser() user: RequestUser) {
    return this.usersService.updateLocation(user.userId, dto);
  }
}
