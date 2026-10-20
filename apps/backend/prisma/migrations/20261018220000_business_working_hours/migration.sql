-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
ADD COLUMN     "workingHours" JSONB;
