ALTER TYPE "PaymentFrequency" ADD VALUE IF NOT EXISTS 'YEARLY';

ALTER TABLE "clients" ADD COLUMN "billingFrequency" "PaymentFrequency" NOT NULL DEFAULT 'MONTHLY';
CREATE INDEX "clients_billingFrequency_idx" ON "clients"("billingFrequency");
