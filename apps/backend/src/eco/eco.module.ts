import { Module } from "@nestjs/common";
import { EcoController } from "./eco.controller";
import { EcoService } from "./eco.service";

@Module({
  controllers: [EcoController],
  providers: [EcoService],
})
export class EcoModule {}
