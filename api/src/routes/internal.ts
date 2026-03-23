/**
 * Internal routes — protected by INTERNAL_SECRET env var.
 * For use with Heroku Scheduler or similar external cron triggers.
 */
import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { runRetirement } from '../jobs/retirementJob';

export const internalRouter = Router();

// POST /internal/run-retirement
// Protected by INTERNAL_SECRET header. Configure Heroku Scheduler to call this nightly.
internalRouter.post('/run-retirement', async (req, res, next) => {
  try {
    const secret = process.env['INTERNAL_SECRET'];
    if (!secret) throw new AppError('INTERNAL_ERROR', 'INTERNAL_SECRET not configured', 500);
    if (req.headers['x-internal-secret'] !== secret) {
      throw new AppError('FORBIDDEN', 'Invalid internal secret', 403);
    }
    const count = await runRetirement();
    res.json({ retired: count });
  } catch (err) {
    next(err);
  }
});
