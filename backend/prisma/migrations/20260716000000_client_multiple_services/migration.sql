ALTER TABLE "clients"
  RENAME COLUMN "service" TO "services";

DROP INDEX IF EXISTS "clients_service_idx";

ALTER TABLE "clients"
  ALTER COLUMN "services" TYPE "ClientService"[]
  USING ARRAY["services"]::"ClientService"[];
