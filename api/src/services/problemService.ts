import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

/** Pad a float array to 200 dims (2 floats/hold × 100 holds max) with zeros for pgvector. */
function padVector(v: number[], targetDim = 200): number[] {
  if (v.length >= targetDim) return v.slice(0, targetDim);
  return [...v, ...Array<number>(targetDim - v.length).fill(0)];
}

/** Parse a V-grade string to a numeric value for sorting. VB → -1, V0 → 0, V5+ → 5.5, etc. */
function parseVGrade(grade: string): number {
  if (/^VB$/i.test(grade)) return -1;
  const m = /^[Vv](\d+)(\+?)$/.exec(grade);
  if (!m || !m[1]) return 0;
  return parseInt(m[1], 10) + (m[2] === '+' ? 0.5 : 0);
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

export interface ProblemDetail extends ProblemWithGym {
  retired_at: string | null;
  total_attempts: number;
  flash_count: number;
  ascent_summary: {
    total_sends: number;
    total_attempts: number;
    flash_count: number;
    grade_distribution: Record<string, number>;
  };
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

export async function getProblemDetail(problemId: string): Promise<ProblemDetail> {
  type Row = {
    id: string; gym_id: string; colour: string; status: string;
    consensus_grade: string | null; total_sends: number;
    first_upload_at: string; retired_at: string | null;
    gym_name: string; total_attempts: number; flash_count: number;
  };

  const { rows } = await pool.query<Row>(
    `SELECT p.id, p.gym_id, p.colour, p.status, p.consensus_grade, p.total_sends,
            p.first_upload_at, p.retired_at, g.name AS gym_name,
            COUNT(a.id)::int AS total_attempts,
            COUNT(a.id) FILTER (WHERE a.type = 'flash')::int AS flash_count
     FROM problems p
     JOIN gyms g ON g.id = p.gym_id
     LEFT JOIN ascents a ON a.problem_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, g.id`,
    [problemId],
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Problem not found', 404);
  const r = rows[0];

  // Grade distribution
  const { rows: gradeRows } = await pool.query<{ user_grade: string; cnt: number }>(
    `SELECT user_grade, COUNT(*)::int AS cnt
     FROM ascents
     WHERE problem_id = $1 AND user_grade IS NOT NULL
     GROUP BY user_grade`,
    [problemId],
  );
  const grade_distribution: Record<string, number> = {};
  for (const { user_grade, cnt } of gradeRows) {
    grade_distribution[user_grade] = cnt;
  }

  const sendCount = Math.max(r.total_sends, 0);
  return {
    id: r.id,
    gym_id: r.gym_id,
    colour: r.colour,
    status: r.status as 'active' | 'retired',
    consensus_grade: r.consensus_grade,
    total_sends: sendCount,
    first_upload_at: r.first_upload_at,
    retired_at: r.retired_at,
    gym_name: r.gym_name,
    total_attempts: r.total_attempts,
    flash_count: r.flash_count,
    ascent_summary: {
      total_sends: sendCount,
      total_attempts: r.total_attempts,
      flash_count: r.flash_count,
      grade_distribution,
    },
  };
}

export async function incrementTotalSends(problemId: string): Promise<void> {
  await pool.query(`UPDATE problems SET total_sends = total_sends + 1 WHERE id = $1`, [problemId]);
}

/** Recalculate consensus_grade from the median of all voted user_grades on this problem. */
export async function calculateConsensusGrade(problemId: string): Promise<void> {
  const { rows } = await pool.query<{ user_grade: string }>(
    `SELECT user_grade FROM ascents WHERE problem_id = $1 AND user_grade IS NOT NULL`,
    [problemId],
  );
  if (rows.length === 0) return;

  const sorted = rows
    .map((r) => r.user_grade)
    .sort((a, b) => parseVGrade(a) - parseVGrade(b));
  const median = sorted[Math.floor(sorted.length / 2)]!;

  await pool.query(`UPDATE problems SET consensus_grade = $1 WHERE id = $2`, [median, problemId]);
}
