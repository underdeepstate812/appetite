import { Module } from "@nestjs/common";
import { OfferSchedulesController } from "./offer-schedules.controller";
import { OfferSchedulesService } from "./offer-schedules.service";
import { OfferSchedulesMaterializer } from "./offer-schedules.materializer";

@Module({
  controllers: [OfferSchedulesController],
  providers: [OfferSchedulesService, OfferSchedulesMaterializer],
  exports: [OfferSchedulesMaterializer],
})
export class OfferSchedulesModule {}
