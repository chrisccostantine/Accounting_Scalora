import { Router } from 'express';
import { createAttachment, deleteAttachment, listAttachments } from '../controllers/attachment.controller.js';
import { validate } from '../middleware/validate.js';
import { attachmentSchema } from '../validators/attachment.js';

export const attachmentRouter = Router();

attachmentRouter.get('/', listAttachments);
attachmentRouter.post('/', validate(attachmentSchema), createAttachment);
attachmentRouter.delete('/:id', deleteAttachment);
