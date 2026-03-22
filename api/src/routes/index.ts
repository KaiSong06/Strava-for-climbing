import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { followsRouter } from './follows';
import { gymsRouter } from './gyms';
import { feedRouter } from './feed';

export const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/users', followsRouter);
router.use('/gyms', gymsRouter);
router.use('/feed', feedRouter);
