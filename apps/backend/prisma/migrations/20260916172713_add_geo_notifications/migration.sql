-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "pickupReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "expoPushToken" TEXT,
ADD COLUMN     "lastLat" DOUBLE PRECISION,
ADD COLUMN     "lastLng" DOUBLE PRECISION,
ADD COLUMN     "notifyRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5;

-- CreateIndex
CREATE INDEX "users_lastLat_lastLng_idx" ON "users"("lastLat", "lastLng");
