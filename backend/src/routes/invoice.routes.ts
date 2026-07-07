import { Router } from 'express';
import { addInvoicePayment, createInvoice, deleteInvoice, listInvoices, updateInvoice } from '../controllers/invoice.controller.js';
import { validate } from '../middleware/validate.js';
import { invoicePaymentSchema, invoiceSchema } from '../validators/invoice.js';

export const invoiceRouter = Router();

invoiceRouter.get('/', listInvoices);
invoiceRouter.post('/', validate(invoiceSchema), createInvoice);
invoiceRouter.put('/:id', validate(invoiceSchema), updateInvoice);
invoiceRouter.delete('/:id', deleteInvoice);
invoiceRouter.post('/:id/payments', validate(invoicePaymentSchema), addInvoicePayment);
