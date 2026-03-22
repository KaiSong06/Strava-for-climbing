import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { gymsRouter } from './gyms';

export const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/gyms', gymsRouter);
