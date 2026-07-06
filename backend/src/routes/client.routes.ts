import { Router } from 'express';
import { createClient, deleteClient, getClient, listClients, updateClient } from '../controllers/client.controller.js';
import { validate } from '../middleware/validate.js';
import { idParam, listQuery } from '../validators/common.js';
import { clientSchema } from '../validators/client.js';

export const clientRouter = Router();
clientRouter.get('/', validate(listQuery), listClients);
clientRouter.post('/', validate(clientSchema), createClient);
clientRouter.get('/:id', validate(idParam), getClient);
clientRouter.put('/:id', validate(idParam.merge(clientSchema)), updateClient);
clientRouter.delete('/:id', validate(idParam), deleteClient);
