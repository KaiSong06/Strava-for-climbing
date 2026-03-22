import { Router } from 'express';
import * as gymService from '../services/gymService';

export const gymsRouter = Router();

gymsRouter.get('/', async (_req, res, next) => {
  try {
    const gyms = await gymService.listAll();
    res.json({ data: gyms });
  } catch (err) {
    next(err);
  }
});
