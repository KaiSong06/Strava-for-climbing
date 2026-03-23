import crypto from 'crypto';
import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { sendVerificationEmail } from './emailService';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function sendVerification(userId: string, email: string): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
    [userId, tokenHash],
  );

  await sendVerificationEmail(email, rawToken);
}

export async function verify(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);

  const { rows } = await pool.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM email_verification_tokens
     WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row) {
    throw new AppError('INVALID_TOKEN', 'Verification token is invalid or has expired', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET email_verified = true WHERE id = $1', [row.user_id]);
    await client.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
