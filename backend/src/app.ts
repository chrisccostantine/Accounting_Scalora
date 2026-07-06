import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { requireAuth } from './middleware/auth.js';
import { fail, ok } from './utils/api.js';
import { authRouter } from './routes/auth.routes.js';
import { clientRouter } from './routes/client.routes.js';
import { incomeRouter } from './routes/income.routes.js';
import { expenseRouter } from './routes/expense.routes.js';
import { advanceRouter } from './routes/advance.routes.js';
import { reportRouter } from './routes/report.routes.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500 }));

app.get('/health', (_req, res) => ok(res, 'API healthy'));
app.use('/api/auth', authRouter);
app.use('/api', requireAuth, reportRouter);
app.use('/api/clients', requireAuth, clientRouter);
app.use('/api/income', requireAuth, incomeRouter);
app.use('/api/expenses', requireAuth, expenseRouter);
app.use('/api/advances', requireAuth, advanceRouter);
app.use((_req, res) => fail(res, 'Route not found', 404));
app.use(errorHandler);
