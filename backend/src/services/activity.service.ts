import type { ActivityAction } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export function recordActivity(input: { action: ActivityAction; entityType: string; entityId?: string | null; title: string; details?: string | null }) {
  return prisma.activityLog.create({ data: input }).catch(() => null);
}
