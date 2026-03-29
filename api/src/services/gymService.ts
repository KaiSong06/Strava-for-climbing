import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

interface GymRow {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  default_retirement_days: number;
  created_at: string;
}

export interface GymDetail extends GymRow {
  active_problem_count: number;
  total_ascents_all_time: number;
}

export interface GymProblem {
  id: string;
  colour: string;
  consensus_grade: string | null;
  total_sends: number;
  total_attempts: number;
  flash_count: number;
  first_upload_at: string;
  retired_at: string | null;
  thumbnail_url: string | null;
}

export interface RetiredProblemGroup {
  month: string;
  problems: GymProblem[];
}

export interface NearbyGymRow extends GymRow {
  distance_km: number;
}

export async function findNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  limit: number,
): Promise<NearbyGymRow[]> {
  const { rows } = await pool.query<NearbyGymRow>(
    `WITH ranked AS (
       SELECT id, name, city, lat, lng, default_retirement_days, created_at,
              ROUND(CAST(
                6371 * acos(
                  LEAST(1.0, cos(radians($1)) * cos(radians(lat)) *
                  cos(radians(lng) - radians($2)) +
                  sin(radians($1)) * sin(radians(lat)))
                ) AS numeric), 1) AS distance_km
       FROM gyms
     )
     SELECT * FROM ranked
     WHERE distance_km <= $3
     ORDER BY distance_km ASC
     LIMIT $4`,
    [lat, lng, radiusKm, limit],
  );
  return rows;
}

export async function listAll(): Promise<GymRow[]> {
  const { rows } = await pool.query<GymRow>(
    'SELECT id, name, city, lat, lng, default_retirement_days, created_at FROM gyms ORDER BY name',
  );
  return rows;
}

export async function getGymById(gymId: string): Promise<GymDetail> {
  const { rows } = await pool.query<GymDetail>(
    `SELECT g.id, g.name, g.city, g.lat, g.lng, g.default_retirement_days, g.created_at,
            COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS active_problem_count,
            COUNT(DISTINCT a.id) AS total_ascents_all_time
     FROM gyms g
     LEFT JOIN problems p ON p.gym_id = g.id
     LEFT JOIN ascents a ON a.problem_id = p.id
     WHERE g.id = $1
     GROUP BY g.id`,
    [gymId],
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Gym not found', 404);
  return rows[0];
}

// Shared query fragment for problem listings
const PROBLEM_SELECT = `
  SELECT p.id, p.colour, p.consensus_grade, p.total_sends,
         p.first_upload_at, p.retired_at,
         COUNT(a.id)::int AS total_attempts,
         COUNT(a.id) FILTER (WHERE a.type = 'flash')::int AS flash_count,
         (SELECT u.photo_urls[1] FROM uploads u
          WHERE u.problem_id = p.id AND array_length(u.photo_urls, 1) > 0
          ORDER BY u.created_at ASC LIMIT 1) AS thumbnail_url
  FROM problems p
  LEFT JOIN ascents a ON a.problem_id = p.id`;

export async function getGymProblems(
  gymId: string,
  status: 'active' | 'retired' | 'all',
  cursor: string | undefined,
  limit = 20,
): Promise<{ data: GymProblem[]; cursor: string | null; has_more: boolean }> {
  const statusClause = status === 'all' ? '' : `AND p.status = '${status}'::problem_status`;
  const cursorClause = cursor
    ? `AND (p.first_upload_at, p.id::text) < (
        SELECT first_upload_at, id::text FROM problems WHERE id = $3::uuid
      )`
    : '';

  const params: unknown[] = [gymId, limit + 1];
  if (cursor) params.push(cursor);

  const { rows } = await pool.query<GymProblem>(
    `${PROBLEM_SELECT}
     WHERE p.gym_id = $1 ${statusClause} ${cursorClause}
     GROUP BY p.id
     ORDER BY p.first_upload_at DESC, p.id DESC
     LIMIT $2`,
    params,
  );

  const has_more = rows.length > limit;
  const data = has_more ? rows.slice(0, limit) : rows;
  const nextCursor = has_more && data.length > 0 ? data[data.length - 1]!.id : null;
  return { data, cursor: nextCursor, has_more };
}

export async function getRetiredProblemsGrouped(gymId: string): Promise<RetiredProblemGroup[]> {
  const { rows } = await pool.query<GymProblem & { month: string }>(
    `${PROBLEM_SELECT},
          to_char(p.retired_at, 'YYYY-MM') AS month
     WHERE p.gym_id = $1 AND p.status = 'retired'
     GROUP BY p.id
     ORDER BY p.retired_at DESC NULLS LAST, p.id DESC`,
    [gymId],
  );

  const grouped = new Map<string, GymProblem[]>();
  for (const row of rows) {
    const { month, ...problem } = row;
    const key = month ?? 'Unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(problem as GymProblem);
  }
  return Array.from(grouped.entries()).map(([month, problems]) => ({ month, problems }));
}
