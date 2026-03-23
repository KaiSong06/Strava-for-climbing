import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { pool } from '../db/pool';

const expo = new Expo();

export async function registerToken(userId: string, token: string): Promise<void> {
  await pool.query(
    `INSERT INTO push_tokens (user_id, token) VALUES ($1, $2)
     ON CONFLICT (token) DO NOTHING`,
    [userId, token],
  );
}

export async function removeToken(token: string): Promise<void> {
  await pool.query('DELETE FROM push_tokens WHERE token = $1', [token]);
}

export async function sendToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const { rows } = await pool.query<{ token: string }>(
    'SELECT token FROM push_tokens WHERE user_id = $1',
    [userId],
  );

  if (rows.length === 0) return;

  const messages: ExpoPushMessage[] = rows
    .filter((r) => Expo.isExpoPushToken(r.token))
    .map((r) => ({ to: r.token, title, body, data }));

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    let tickets: ExpoPushTicket[];
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('[push] send chunk failed:', err);
      continue;
    }

    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        console.error('[push] ticket error:', ticket.message, ticket.details);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          const msg = chunk[i];
          if (msg && typeof msg.to === 'string') invalidTokens.push(msg.to);
        }
      }
    });
  }

  // Remove stale tokens
  if (invalidTokens.length > 0) {
    await pool.query('DELETE FROM push_tokens WHERE token = ANY($1)', [invalidTokens]);
  }
}
