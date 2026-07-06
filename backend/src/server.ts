import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { ensureAdminUser } from './services/admin.service.js';

async function start() {
  await ensureAdminUser();

  app.listen(env.PORT, () => {
    logger.info(`Scalora Accounting API running on port ${env.PORT}`);
  });
}

start().catch((error) => {
  logger.error('Failed to start API', { error });
  process.exit(1);
});
