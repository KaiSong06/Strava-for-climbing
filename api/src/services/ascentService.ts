import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

export type AscentType = 'flash' | 'send' | 'attempt';
export type AscentVisibility = 'public' | 'friends' | 'private';

export interface AscentInput {
  user_grade: string | null;
  rating: number | null;
  notes: string | null;
  video_url: string | null;
  visibility: AscentVisibility;
}

export interface AscentWithDetails {
  id: string;
  type: AscentType;
  user_grade: string | null;
  rating: number | null;
  notes: string | null;
  visibility: AscentVisibility;
  logged_at: string;
  problem: {
    id: string;
    colour: string;
    consensus_grade: string | null;
    gym: { id: string; name: string };
  };
}

/** Flash = first ever send; send = already logged at least once before. */
async function resolveType(userId: string, problemId: string): Promise<AscentType> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM ascents WHERE user_id = $1 AND problem_id = $2 LIMIT 1`,
    [userId, problemId],
  );
  return (rowCount ?? 0) === 0 ? 'flash' : 'send';
}

export async function createAscent(
  userId: string,
  problemId: string,
  input: AscentInput,
): Promise<string> {
  const type = await resolveType(userId, problemId);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO ascents (user_id, problem_id, type, user_grade, rating, notes, video_url, visibility)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [userId, problemId, type, input.user_grade, input.rating, input.notes, input.video_url, input.visibility],
  );
  if (!rows[0]) throw new AppError('INTERNAL_ERROR', 'Failed to create ascent', 500);
  return rows[0].id;
}

export async function getAscentById(ascentId: string): Promise<AscentWithDetails> {
  type Row = {
    id: string; type: string; user_grade: string | null; rating: number | null;
    notes: string | null; visibility: string; logged_at: string;
    problem_id: string; colour: string; consensus_grade: string | null;
    gym_id: string; gym_name: string;
  };

  const { rows } = await pool.query<Row>(
    `SELECT a.id, a.type, a.user_grade, a.rating, a.notes, a.visibility, a.logged_at,
            p.id AS problem_id, p.colour, p.consensus_grade,
            g.id AS gym_id, g.name AS gym_name
     FROM ascents a
     JOIN problems p ON p.id = a.problem_id
     JOIN gyms     g ON g.id = p.gym_id
     WHERE a.id = $1`,
    [ascentId],
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Ascent not found', 404);
  const r = rows[0];
  return {
    id: r.id,
    type: r.type as AscentType,
    user_grade: r.user_grade,
    rating: r.rating,
    notes: r.notes,
    visibility: r.visibility as AscentVisibility,
    logged_at: r.logged_at,
    problem: {
      id: r.problem_id,
      colour: r.colour,
      consensus_grade: r.consensus_grade,
      gym: { id: r.gym_id, name: r.gym_name },
    },
  };
}
