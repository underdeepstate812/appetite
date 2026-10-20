import { Module } from "@nestjs/common";
import { DiscountSchedulerService } from "./discount-scheduler.service";
import { SchedulerController } from "./scheduler.controller";
import { OfferSchedulesModule } from "../offer-schedules/offer-schedules.module";

@Module({
  imports: [OfferSchedulesModule],
  controllers: [SchedulerController],
  providers: [DiscountSchedulerService],
})
export class SchedulerModule {}
