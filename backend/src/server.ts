import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { ensureAdminUser } from './services/admin.service.js';
import { generateCurrentPeriodInvoices } from './services/invoice-generation.service.js';

async function start() {
  await ensureAdminUser();
  const generated = await generateCurrentPeriodInvoices();
  if (generated.created.length) logger.info(`Generated ${generated.created.length} invoice(s) for current billing period`);

  app.listen(env.PORT, () => {
    logger.info(`Scalora Accounting API running on port ${env.PORT}`);
  });
}

start().catch((error) => {
  logger.error('Failed to start API', { error });
  process.exit(1);
});
