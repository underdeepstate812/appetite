import { Controller, Get, UseGuards } from "@nestjs/common";
import { EcoService } from "./eco.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("eco")
export class EcoController {
  constructor(private readonly ecoService: EcoService) {}

  @Get("me")
  getMySummary(@CurrentUser() user: RequestUser) {
    return this.ecoService.getSummary(user.userId);
  }
}
