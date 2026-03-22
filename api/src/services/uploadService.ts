import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

export interface UploadRow {
  id: string;
  user_id: string;
  problem_id: string | null;
  photo_urls: string[];
  processing_status: string;
  similarity_score: number | null;
  /** Stored as JSONB; pg returns a parsed JS array. */
  hold_vector: number[] | null;
  gym_id: string | null;
  colour: string | null;
  created_at: string;
}

export async function createUpload(
  userId: string,
  gymId: string,
  colour: string,
  photoUrls: string[],
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO uploads (user_id, gym_id, colour, photo_urls, processing_status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [userId, gymId, colour, photoUrls],
  );
  if (!rows[0]) throw new AppError('INTERNAL_ERROR', 'Failed to create upload', 500);
  return rows[0].id;
}

export async function getUploadById(uploadId: string): Promise<UploadRow> {
  const { rows } = await pool.query<UploadRow>(
    `SELECT id, user_id, problem_id, photo_urls, processing_status,
            similarity_score, hold_vector, gym_id, colour, created_at
     FROM uploads WHERE id = $1`,
    [uploadId],
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Upload not found', 404);
  return rows[0];
}

export interface UpdateUploadInput {
  processing_status?: string;
  similarity_score?: number;
  /** JS array — stored as JSONB. */
  hold_vector?: number[];
  problem_id?: string;
}

export async function updateUpload(uploadId: string, input: UpdateUploadInput): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [uploadId];
  let idx = 2;

  if (input.processing_status !== undefined) {
    sets.push(`processing_status = $${idx++}::processing_status`);
    vals.push(input.processing_status);
  }
  if (input.similarity_score !== undefined) {
    sets.push(`similarity_score = $${idx++}`);
    vals.push(input.similarity_score);
  }
  if (input.hold_vector !== undefined) {
    sets.push(`hold_vector = $${idx++}::jsonb`);
    vals.push(JSON.stringify(input.hold_vector));
  }
  if (input.problem_id !== undefined) {
    sets.push(`problem_id = $${idx++}`);
    vals.push(input.problem_id);
  }

  if (sets.length === 0) return;
  await pool.query(`UPDATE uploads SET ${sets.join(', ')} WHERE id = $1`, vals);
}
