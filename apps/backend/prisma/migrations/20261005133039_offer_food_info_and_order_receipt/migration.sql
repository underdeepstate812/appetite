-- CreateEnum
CREATE TYPE "ReceiptDisputeReason" AS ENUM ('NOT_RECEIVED', 'WRONG_ITEM', 'QUALITY', 'OTHER');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RECEIPT_DISPUTED';

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allergensDeclared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bestBefore" TIMESTAMP(3),
ADD COLUMN     "ingredients" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "receiptConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "receiptDisputeNote" TEXT,
ADD COLUMN     "receiptDisputeReason" "ReceiptDisputeReason",
ADD COLUMN     "receiptDisputedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_receiptDisputedAt_idx" ON "orders"("receiptDisputedAt");
