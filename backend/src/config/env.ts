import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url(),
  ADMIN_EMAIL: z.string().email().default('admin@scalora.local'),
  ADMIN_PASSWORD: z.string().min(8).default('change-this-password')
});

export const env = schema.parse(process.env);
