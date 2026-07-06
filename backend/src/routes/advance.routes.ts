import { Router } from 'express';
import { createAdvance, createRepayment, deleteAdvance, deleteRepayment, listAdvances, updateAdvance } from '../controllers/advance.controller.js';
import { validate } from '../middleware/validate.js';
import { idParam, listQuery } from '../validators/common.js';
import { advanceSchema, repaymentSchema } from '../validators/advance.js';

export const advanceRouter = Router();
advanceRouter.get('/', validate(listQuery), listAdvances);
advanceRouter.post('/', validate(advanceSchema), createAdvance);
advanceRouter.put('/:id', validate(idParam.merge(advanceSchema)), updateAdvance);
advanceRouter.delete('/:id', validate(idParam), deleteAdvance);
advanceRouter.post('/:id/repayments', validate(idParam.merge(repaymentSchema)), createRepayment);
advanceRouter.delete('/repayments/:id', validate(idParam), deleteRepayment);
