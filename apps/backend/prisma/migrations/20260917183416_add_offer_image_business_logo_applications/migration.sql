-- CreateEnum
CREATE TYPE "BusinessApplicationStatus" AS ENUM ('NEW', 'REVIEWED');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "business_applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "OfferCategory" NOT NULL,
    "address" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "ofertaAccepted" BOOLEAN NOT NULL DEFAULT false,
    "status" "BusinessApplicationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_applications_status_idx" ON "business_applications"("status");
