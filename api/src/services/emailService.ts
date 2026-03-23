import { Resend } from 'resend';
import { AppError } from '../middleware/errorHandler';

function getClient(): Resend {
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) throw new AppError('SERVER_ERROR', 'RESEND_API_KEY is not configured', 500);
  return new Resend(apiKey);
}

function getSender(): string {
  return process.env['EMAIL_FROM'] ?? 'Crux <noreply@crux.app>';
}

function getFrontendUrl(): string {
  return process.env['FRONTEND_URL'] ?? 'http://localhost:3001';
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const { error } = await getClient().emails.send({
    from: getSender(),
    to,
    subject,
    html,
  });
  if (error) {
    console.error('[email] send failed:', error);
    throw new AppError('SERVER_ERROR', 'Failed to send email', 500);
  }
}

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const link = `${getFrontendUrl()}/reset-password?token=${rawToken}`;
  await sendEmail(
    to,
    'Reset your Crux password',
    `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
     <p><a href="${link}">${link}</a></p>
     <p>If you didn't request this, you can ignore this email.</p>`,
  );
}

export async function sendVerificationEmail(to: string, rawToken: string): Promise<void> {
  const link = `${getFrontendUrl()}/verify-email?token=${rawToken}`;
  await sendEmail(
    to,
    'Verify your Crux email address',
    `<p>Click the link below to verify your email address.</p>
     <p><a href="${link}">${link}</a></p>
     <p>This link expires in 24 hours.</p>`,
  );
}
