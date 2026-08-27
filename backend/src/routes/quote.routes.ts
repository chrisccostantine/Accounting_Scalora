import { Router } from 'express';
import { createQuote, deleteQuote, downloadQuotePdf, listQuotes, updateQuote } from '../controllers/quote.controller.js';
import { validate } from '../middleware/validate.js';
import { quoteSchema } from '../validators/quote.js';

export const quoteRouter = Router();
quoteRouter.get('/', listQuotes);
quoteRouter.post('/', validate(quoteSchema), createQuote);
quoteRouter.put('/:id', validate(quoteSchema), updateQuote);
quoteRouter.delete('/:id', deleteQuote);
quoteRouter.get('/:id/pdf', downloadQuotePdf);
