CREATE TYPE "ClientService" AS ENUM ('META_ADS', 'TIKTOK_ADS', 'GOOGLE_ADS', 'SOCIAL_MEDIA_MANAGEMENT', 'CONTENT_CREATION', 'SHOPIFY_STORE', 'WEBSITE_DEVELOPMENT', 'WEB_APPLICATION', 'MOBILE_APPLICATION', 'BRANDING', 'OTHER');
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'WHISH', 'OMT', 'TRANSFER', 'OTHER');
CREATE TYPE "ExpenseCategory" AS ENUM ('OFFICE', 'SOFTWARE', 'ADS', 'FREELANCER', 'EMPLOYEE', 'INTERNET', 'PHONE', 'TRANSPORTATION', 'EQUIPMENT', 'UTILITIES', 'MARKETING', 'OTHER');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clients" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "company" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "service" "ClientService" NOT NULL,
  "monthlyFee" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
  "contractStartDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "income" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "date" TIMESTAMP(3) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "referenceNumber" TEXT,
  "description" TEXT,
  "invoiceNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "income_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expenses" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "category" "ExpenseCategory" NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "vendor" TEXT,
  "receiptNumber" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "clients_status_idx" ON "clients"("status");
CREATE INDEX "clients_service_idx" ON "clients"("service");
CREATE INDEX "income_clientId_idx" ON "income"("clientId");
CREATE INDEX "income_date_idx" ON "income"("date");
CREATE INDEX "expenses_category_idx" ON "expenses"("category");
CREATE INDEX "expenses_date_idx" ON "expenses"("date");
ALTER TABLE "income" ADD CONSTRAINT "income_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
