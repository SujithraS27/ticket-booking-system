

import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';

/**
 * Email abstraction. Supports:
 *  - "log":   prints the mail to the console (default, zero-config dev).
 *  - "smtp":  real delivery via configurable SMTP (any free tier,
 *             e.g. Ethereal for dev, Console.amazonaws / SendGrid / Mailgun for prod).
 *
 * Emails are sent on a best-effort basis and never block the request.
 */

interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

let cachedTransporter: Transporter | null = null;

/** Captured mails available to tests (only when NODE_ENV === 'test'). */
const sentMails: Array<{ to: string; subject: string }> = [];
export function getSentEmails(): Array<{ to: string; subject: string }> {
  return sentMails;
}
export function clearSentEmails(): void {
  sentMails.length = 0;
}

function transporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  if (config.emailTransport === 'smtp' && config.smtpHost) {
    cachedTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
    });
  } else {
    // Log transport keeps a record of deliveries and is safe in every environment.
    cachedTransporter = nodemailer.createTransport({
      name: 'tickets',
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
  }
  return cachedTransporter;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    sentMails.push({ to: message.to, subject: message.subject });
  }
  transporter().sendMail(
    {
      from: config.emailFrom,
      to: message.to,
      subject: message.subject,
      html: message.html,
    },
    (err, info) => {
      if (err) {
        console.error('[mailer] failed to send email:', err.message);
        return;
      }
      if (config.emailTransport === 'log' && !config.isDev) {
        console.log(`[mailer] logged email to ${message.to}: ${message.subject}`);
      }
      if (config.nodeEnv === 'development') {
        console.log(`[mailer] dev email -> ${message.to} :: ${message.subject}`);
      }
    },
  );
}

// ---- Mail builders ---------------------------------------------------

export function bookingConfirmationMail(opts: {
  to: string;
  customerName: string;
  reference: string;
  eventTitle: string;
  venueName: string;
  startsAt: Date;
  seats: Array<{ label: string; category: string }>;
  totalCents: number;
  qrDataUrl: string;
}) {
  const lines = opts.seats
    .map(
      (s) =>
        `<li><strong>${escapeHtml(s.label)}</strong> &mdash; ${escapeHtml(
          s.category,
        )}</li>`,
    )
    .join('');
  const start = opts.startsAt.toISOString().replace('T', ' ').slice(0, 16);

  return {
    subject: `Your ticket is confirmed — ${opts.eventTitle}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <h2 style="margin:0 0 4px">Booking confirmed 🎉</h2>
    <p style="color:#475569">Hi ${escapeHtml(opts.customerName)}, your seats are locked in.</p>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:6px 0;color:#64748b">Booking ref</td><td style="padding:6px 0"><strong>${escapeHtml(opts.reference)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Event</td><td style="padding:6px 0">${escapeHtml(opts.eventTitle)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Venue</td><td style="padding:6px 0">${escapeHtml(opts.venueName)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Starts</td><td style="padding:6px 0">${escapeHtml(start)}</td></tr>
    </table>
    <table style="border-collapse:collapse;width:100%;margin-top:12px">
      <tr style="background:#f8fafc"><th align="left" style="padding:8px">Seats</th><th align="right" style="padding:8px">Category</th></tr>
      ${lines}
    </table>
    <p style="font-size:18px;font-weight:600;margin:16px 0 0">Total: ${(opts.totalCents / 100).toFixed(2)}</p>
    <p style="margin:20px 0 8px;color:#64748b">Show this QR code at the entrance:</p>
    <img src="${opts.qrDataUrl}" alt="QR ticket" width="180" height="180" style="border:1px solid #e2e8f0;border-radius:8px"/>
    <p style="color:#94a3b8;font-size:12px;margin-top:16px">This is an automated email from the Ticket Booking System.</p>
  </div>`,
  };
}

export function waitlistOfferMail(opts: {
  to: string;
  customerName: string;
  eventTitle: string;
  seatLabel: string;
  priceCents: number;
  expiresAt: Date;
  link: string;
}) {
  return {
    subject: `A seat just opened up — ${opts.eventTitle}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <h2 style="margin:0 0 8px">You're next in line! 🎟️</h2>
    <p style="color:#475569">Hi ${escapeHtml(opts.customerName)}, a seat released for <strong>${escapeHtml(opts.eventTitle)}</strong>.</p>
    <p>Seat <strong>${escapeHtml(opts.seatLabel)}</strong> — ${(opts.priceCents / 100).toFixed(2)}.</p>
    <p style="color:#ef4444">This offer expires at ${opts.expiresAt.toISOString().replace('T', ' ').slice(0, 16)}. If you do not accept, it moves to the next person on the waitlist.</p>
    <p style="margin:24px 0"><a href="${opts.link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Accept seat &amp; get ticket</a></p>
    <p style="color:#94a3b8;font-size:12px">Link expires after ${Math.round(
      requireMsFromEnv() / 60000,
    )} minutes.</p>
  </div>`,
  };
}

function requireMsFromEnv(): number {
  const n = Number(process.env.WAITLIST_OFFER_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : 10 * 60 * 1000;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// ---- Fire-and-forget notifications (never block the API) ----------------

export function notifyBookingConfirmed(opts: {
  to: string;
  customerName: string;
  reference: string;
  eventTitle: string;
  venueName: string;
  startsAt: Date;
  seats: Array<{ label: string; category: string }>;
  totalCents: number;
  qrDataUrl: string;
}): void {
  const mail = bookingConfirmationMail(opts);
  void sendMail({ to: opts.to, subject: mail.subject, html: mail.html });
}

export function notifyWaitlistOffer(opts: {
  to: string;
  customerName: string;
  eventTitle: string;
  seatLabel: string;
  priceCents: number;
  expiresAt: Date;
  token: string;
}): void {
  const link = `${config.frontendUrl}/offers/${opts.token}`;
  const mail = waitlistOfferMail({ ...opts, link });
  void sendMail({ to: opts.to, subject: mail.subject, html: mail.html });
}

export function formatISOTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 16);
}