import { Router } from 'express';
import { login, me } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { loginSchema } from '../validators/auth.js';

export const authRouter = Router();
authRouter.post('/login', validate(loginSchema), login);
authRouter.get('/me', requireAuth, me);
