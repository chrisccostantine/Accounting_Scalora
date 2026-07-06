CREATE TYPE "AdvanceStatus" AS ENUM ('OPEN', 'PAID');

CREATE TABLE "owner_advances" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "date" TIMESTAMP(3) NOT NULL,
  "source" TEXT,
  "plannedInstallments" INTEGER,
  "installmentAmount" DECIMAL(12,2),
  "nextDueDate" TIMESTAMP(3),
  "notes" TEXT,
  "status" "AdvanceStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "owner_advances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "advance_repayments" (
  "id" TEXT NOT NULL,
  "advanceId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "date" TIMESTAMP(3) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "advance_repayments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "owner_advances_date_idx" ON "owner_advances"("date");
CREATE INDEX "owner_advances_status_idx" ON "owner_advances"("status");
CREATE INDEX "advance_repayments_advanceId_idx" ON "advance_repayments"("advanceId");
CREATE INDEX "advance_repayments_date_idx" ON "advance_repayments"("date");
ALTER TABLE "advance_repayments" ADD CONSTRAINT "advance_repayments_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "owner_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
