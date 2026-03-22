import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { followsRouter } from './follows';
import { gymsRouter } from './gyms';
import { feedRouter } from './feed';
import { uploadsRouter } from './uploads';
import { ascentsRouter } from './ascents';
import { problemsRouter } from './problems';

export const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/users', followsRouter);
router.use('/gyms', gymsRouter);
router.use('/feed', feedRouter);
router.use('/uploads', uploadsRouter);
router.use('/ascents', ascentsRouter);
router.use('/problems', problemsRouter);
