/** E-mail delivery. Nothing is sent until an SMTP provider is configured; callers record the outcome honestly. */
import type { AppContext } from './context';
import { safeErrorMessage } from './security/redact';

export type DeliveryStatus = 'sent' | 'not_sent_no_provider' | 'failed';

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export async function sendMail(app: AppContext, msg: MailMessage): Promise<{ status: DeliveryStatus; error?: string }> {
  if (!app.env.smtpConfigured) return { status: 'not_sent_no_provider' };
  if (!msg.to.length) return { status: 'failed', error: 'No recipients' };
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: app.env.SMTP_HOST,
      port: app.env.SMTP_PORT,
      secure: app.env.SMTP_PORT === 465,
      auth: app.env.SMTP_USER ? { user: app.env.SMTP_USER, pass: app.env.SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({ from: app.env.SMTP_FROM, to: msg.to, subject: msg.subject, text: msg.text, attachments: msg.attachments });
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: safeErrorMessage(err) };
  }
}
