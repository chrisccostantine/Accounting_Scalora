import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/prisma.js';

export async function ensureAdminUser() {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: { passwordHash },
    create: {
      email: env.ADMIN_EMAIL,
      passwordHash
    }
  });

  logger.info('Admin user is ready', { email: env.ADMIN_EMAIL });
}
