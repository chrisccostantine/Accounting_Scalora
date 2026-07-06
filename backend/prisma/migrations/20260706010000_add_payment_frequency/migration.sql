CREATE TYPE "PaymentFrequency" AS ENUM ('ONE_TIME', 'MONTHLY');

ALTER TABLE "income" ADD COLUMN "frequency" "PaymentFrequency" NOT NULL DEFAULT 'ONE_TIME';
ALTER TABLE "expenses" ADD COLUMN "frequency" "PaymentFrequency" NOT NULL DEFAULT 'ONE_TIME';

CREATE INDEX "income_frequency_idx" ON "income"("frequency");
CREATE INDEX "expenses_frequency_idx" ON "expenses"("frequency");
