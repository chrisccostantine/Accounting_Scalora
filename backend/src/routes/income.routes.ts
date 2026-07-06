import { Router } from 'express';
import { createIncome, deleteIncome, listIncome, updateIncome } from '../controllers/income.controller.js';
import { validate } from '../middleware/validate.js';
import { idParam, listQuery } from '../validators/common.js';
import { incomeSchema } from '../validators/income.js';

export const incomeRouter = Router();
incomeRouter.get('/', validate(listQuery), listIncome);
incomeRouter.post('/', validate(incomeSchema), createIncome);
incomeRouter.put('/:id', validate(idParam.merge(incomeSchema)), updateIncome);
incomeRouter.delete('/:id', validate(idParam), deleteIncome);
