import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

/** Pad a float array to 200 dims (2 floats/hold × 100 holds max) with zeros for pgvector. */
function padVector(v: number[], targetDim = 200): number[] {
  if (v.length >= targetDim) return v.slice(0, targetDim);
  return [...v, ...Array<number>(targetDim - v.length).fill(0)];
}

export interface ProblemWithGym {
  id: string;
  gym_id: string;
  colour: string;
  status: 'active' | 'retired';
  consensus_grade: string | null;
  total_sends: number;
  first_upload_at: string;
  gym_name: string;
}

/** Creates a new active problem. hold_vector is padded to 200 dims for pgvector storage. */
export async function createProblem(
  gymId: string,
  colour: string,
  holdVector: number[],
): Promise<string> {
  const padded = padVector(holdVector);
  const vectorStr = `[${padded.join(',')}]`;

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
     VALUES ($1, $2, $3::vector, 'active', NOW())
     RETURNING id`,
    [gymId, colour, vectorStr],
  );
  if (!rows[0]) throw new AppError('INTERNAL_ERROR', 'Failed to create problem', 500);
  return rows[0].id;
}

export async function getProblemWithGym(problemId: string): Promise<ProblemWithGym> {
  const { rows } = await pool.query<ProblemWithGym>(
    `SELECT p.id, p.gym_id, p.colour, p.status, p.consensus_grade, p.total_sends,
            p.first_upload_at, g.name AS gym_name
     FROM problems p
     JOIN gyms g ON g.id = p.gym_id
     WHERE p.id = $1`,
    [problemId],
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Problem not found', 404);
  return rows[0];
}

export async function incrementTotalSends(problemId: string): Promise<void> {
  await pool.query(`UPDATE problems SET total_sends = total_sends + 1 WHERE id = $1`, [problemId]);
}
