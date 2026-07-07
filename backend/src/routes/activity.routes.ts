import { Router } from 'express';
import { listActivity } from '../controllers/activity.controller.js';

export const activityRouter = Router();

activityRouter.get('/', listActivity);
