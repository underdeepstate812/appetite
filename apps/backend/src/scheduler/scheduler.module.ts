import { Module } from "@nestjs/common";
import { DiscountSchedulerService } from "./discount-scheduler.service";
import { SchedulerController } from "./scheduler.controller";

@Module({
  controllers: [SchedulerController],
  providers: [DiscountSchedulerService],
})
export class SchedulerModule {}
