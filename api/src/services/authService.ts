import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';

export interface AuthUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_gym_id: string | null;
  email: string;
  home_gym_name: string | null;
  follower_count: number;
  following_count: number;
  created_at: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

function signAccessToken(userId: string, username: string): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new AppError('SERVER_ERROR', 'JWT secret not configured', 500);
  return jwt.sign({ userId, username }, secret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokenPair(userId: string, username: string): Promise<TokenPair> {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = hashToken(raw);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
    [userId, hash],
  );

  return { accessToken: signAccessToken(userId, username), refreshToken: raw };
}

export async function register(username: string, email: string, password: string): Promise<AuthResult> {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM users WHERE username = $1 OR email = $2',
    [username, email],
  );
  if (rowCount && rowCount > 0) {
    throw new AppError('CONFLICT', 'Username or email is already taken', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const { rows } = await pool.query<AuthUser>(
    `INSERT INTO users (username, email, display_name, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, display_name, avatar_url, home_gym_id, email, created_at,
               NULL::text AS home_gym_name, 0 AS follower_count, 0 AS following_count`,
    [username, email, username, passwordHash],
  );

  const user = rows[0]!;
  const tokens = await issueTokenPair(user.id, user.username);
  return { user, ...tokens };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { rows } = await pool.query<AuthUser & { password_hash: string }>(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_gym_id, u.email, u.created_at,
            u.password_hash, g.name AS home_gym_name,
            (SELECT COUNT(*) FROM follows WHERE following_id = u.id)::int AS follower_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id  = u.id)::int AS following_count
     FROM users u
     LEFT JOIN gyms g ON g.id = u.home_gym_id
     WHERE u.email = $1`,
    [email],
  );

  const row = rows[0];
  if (!row) throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);

  const { password_hash: _ph, ...user } = row;
  const tokens = await issueTokenPair(user.id, user.username);
  return { user, ...tokens };
}

export async function refresh(rawToken: string): Promise<{ accessToken: string }> {
  const hash = hashToken(rawToken);

  // Atomically delete and return the token row (rotation — old token can't be reused)
  const { rows } = await pool.query<{ user_id: string }>(
    `DELETE FROM refresh_tokens
     WHERE token_hash = $1 AND expires_at > NOW()
     RETURNING user_id`,
    [hash],
  );

  if (!rows[0]) throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token', 401);

  const { rows: userRows } = await pool.query<{ username: string }>(
    'SELECT username FROM users WHERE id = $1',
    [rows[0].user_id],
  );
  if (!userRows[0]) throw new AppError('UNAUTHORIZED', 'User no longer exists', 401);

  return { accessToken: signAccessToken(rows[0].user_id, userRows[0].username) };
}
