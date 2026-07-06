import { Router } from 'express';
import { dashboard, reports } from '../controllers/report.controller.js';

export const reportRouter = Router();
reportRouter.get('/dashboard', dashboard);
reportRouter.get('/reports', reports);
