import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import * as problemService from '../services/problemService';

export const disputesRouter = Router();

// POST /disputes/:disputeId/vote
// Mounted at /disputes in routes/index.ts
disputesRouter.post('/:disputeId/vote', requireAuth, async (req, res, next) => {
  try {
    const { disputeId } = req.params;
    const { vote } = z.object({ vote: z.enum(['confirm', 'split']) }).parse(req.body);

    // Get dispute + upload + problem
    const { rows: disputeRows } = await pool.query<{
      id: string; status: string; votes_confirm: number; votes_split: number;
      upload_id: string; problem_id: string | null;
      gym_id: string | null; colour: string | null; hold_vector: number[] | null;
    }>(
      `SELECT d.id, d.status, d.votes_confirm, d.votes_split,
              d.upload_id, u.problem_id, u.gym_id, u.colour,
              u.hold_vector::jsonb AS hold_vector
       FROM match_disputes d
       JOIN uploads u ON u.id = d.upload_id
       WHERE d.id = $1`,
      [disputeId],
    );
    const dispute = disputeRows[0];
    if (!dispute) throw new AppError('NOT_FOUND', 'Dispute not found', 404);
    if (dispute.status !== 'open') {
      throw new AppError('INVALID_STATE', 'Dispute is already resolved', 409);
    }
    if (!dispute.problem_id) {
      throw new AppError('INVALID_STATE', 'Disputed upload has no problem linked', 409);
    }

    // Voter must have an ascent on the disputed problem
    const { rows: ascentCheck } = await pool.query(
      `SELECT 1 FROM ascents WHERE user_id = $1 AND problem_id = $2 LIMIT 1`,
      [req.user!.userId, dispute.problem_id],
    );
    if (!ascentCheck[0]) {
      throw new AppError('FORBIDDEN', 'You must have an ascent on this problem to vote', 403);
    }

    // Increment the relevant vote counter
    const voteCol = vote === 'confirm' ? 'votes_confirm' : 'votes_split';
    const { rows: updated } = await pool.query<{
      votes_confirm: number; votes_split: number;
    }>(
      `UPDATE match_disputes SET ${voteCol} = ${voteCol} + 1 WHERE id = $1
       RETURNING votes_confirm, votes_split`,
      [disputeId],
    );
    const { votes_confirm, votes_split } = updated[0]!;
    const total = votes_confirm + votes_split;

    // Resolve if majority + ≥ 3 votes
    let newStatus = 'open';
    if (total >= 3) {
      if (votes_split > votes_confirm) {
        // Split wins — create a new problem and reassign the upload
        const holdVector = Array.isArray(dispute.hold_vector) ? dispute.hold_vector : [];
        if (dispute.gym_id && dispute.colour) {
          const newProblemId = await problemService.createProblem(
            dispute.gym_id,
            dispute.colour,
            holdVector,
          );
          await pool.query(
            `UPDATE uploads SET problem_id = $1 WHERE id = $2`,
            [newProblemId, dispute.upload_id],
          );
        }
        await pool.query(
          `UPDATE match_disputes SET status = 'resolved_split' WHERE id = $1`,
          [disputeId],
        );
        newStatus = 'resolved_split';
      } else if (votes_confirm > votes_split) {
        await pool.query(
          `UPDATE match_disputes SET status = 'resolved_confirm' WHERE id = $1`,
          [disputeId],
        );
        newStatus = 'resolved_confirm';
      }
    }

    res.json({ disputeId, status: newStatus, votes_confirm, votes_split });
  } catch (err) {
    next(err);
  }
});
