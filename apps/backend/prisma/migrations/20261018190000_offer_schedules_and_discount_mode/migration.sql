-- CreateEnum
CREATE TYPE "DiscountMode" AS ENUM ('DYNAMIC', 'FIXED');

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "discountMode" "DiscountMode" NOT NULL DEFAULT 'DYNAMIC',
ADD COLUMN     "occurrenceDate" TEXT,
ADD COLUMN     "scheduleId" TEXT;

-- CreateTable
CREATE TABLE "offer_schedules" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "OfferCategory" NOT NULL,
    "originalPrice" INTEGER NOT NULL,
    "baseDiscountPercent" INTEGER NOT NULL DEFAULT 50,
    "discountMode" "DiscountMode" NOT NULL DEFAULT 'DYNAMIC',
    "imageUrl" TEXT,
    "quantityTotal" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "ingredients" TEXT,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergensDeclared" BOOLEAN NOT NULL DEFAULT false,
    "bestBeforeHoursAfterEnd" INTEGER,
    "daysOfWeek" INTEGER[],
    "pickupStartTime" TEXT NOT NULL,
    "pickupEndTime" TEXT NOT NULL,
    "publishLeadMinutes" INTEGER NOT NULL DEFAULT 180,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "startsOn" TEXT,
    "endsOn" TEXT,
    "skipDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offer_schedules_businessId_idx" ON "offer_schedules"("businessId");

-- CreateIndex
CREATE INDEX "offer_schedules_isActive_idx" ON "offer_schedules"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "offers_scheduleId_occurrenceDate_key" ON "offers"("scheduleId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "offer_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_schedules" ADD CONSTRAINT "offer_schedules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

