import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { sendPasswordResetEmail } from './emailService';

const BCRYPT_ROUNDS = 12;
const EXPIRY_HOURS = 1;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function requestReset(email: string): Promise<void> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [email],
  );

  // Always return success to prevent email enumeration
  if (!rows[0]) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '${EXPIRY_HOURS} hours')
     ON CONFLICT (token_hash) DO NOTHING`,
    [rows[0].id, tokenHash],
  );

  await sendPasswordResetEmail(email, rawToken);
}

export async function executeReset(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);

  const { rows } = await pool.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row) {
    throw new AppError('INVALID_TOKEN', 'Reset token is invalid or has expired', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update password, mark token used, and invalidate all sessions — in one transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, row.user_id]);
    await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
    await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [row.user_id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
