-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Contract"
  ADD COLUMN "value"     DECIMAL(14, 2),
  ADD COLUMN "currency"  CHAR(3),
  ADD COLUMN "status"    "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Contract_userId_deletedAt_idx" ON "Contract" ("userId", "deletedAt");
CREATE INDEX "Contract_userId_status_idx"    ON "Contract" ("userId", "status");
CREATE INDEX "Contract_endDate_idx"          ON "Contract" ("endDate");
