import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@scalora.local';
  const password = process.env.ADMIN_PASSWORD ?? 'change-this-password';
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
