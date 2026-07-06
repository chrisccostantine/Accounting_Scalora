import { Router } from 'express';
import { createExpense, deleteExpense, listExpenses, updateExpense } from '../controllers/expense.controller.js';
import { validate } from '../middleware/validate.js';
import { idParam, listQuery } from '../validators/common.js';
import { expenseSchema } from '../validators/expense.js';

export const expenseRouter = Router();
expenseRouter.get('/', validate(listQuery), listExpenses);
expenseRouter.post('/', validate(expenseSchema), createExpense);
expenseRouter.put('/:id', validate(idParam.merge(expenseSchema)), updateExpense);
expenseRouter.delete('/:id', validate(idParam), deleteExpense);
