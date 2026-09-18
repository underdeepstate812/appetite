import { Module } from "@nestjs/common";
import { BusinessApplicationsController } from "./business-applications.controller";
import { BusinessApplicationsService } from "./business-applications.service";

@Module({
  controllers: [BusinessApplicationsController],
  providers: [BusinessApplicationsService],
})
export class BusinessApplicationsModule {}
