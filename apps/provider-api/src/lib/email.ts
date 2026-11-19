import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

/**
 * Transactional email with two possible transports: SMTP (any provider
 * -- GoDaddy, Office 365, Gmail, Resend SMTP, SES, self-hosted) via
 * nodemailer, or Resend's HTTP API with plain fetch.
 *
 * Selection: SMTP wins when SMTP_HOST is set. Otherwise Resend when
 * RESEND_API_KEY is set. Otherwise the module is a no-op: every send
 * logs one "skipped" line and returns false. A clinic's provisioning
 * never fails because email is missing or down.
 *
 * Env (any one of these working combinations):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
 *      (GoDaddy Professional Email: smtp.secureserver.net / 587 / STARTTLS,
 *       or smtpout.secureserver.net / 465 / SSL)
 *   RESEND_API_KEY, MAIL_FROM
 *      (Resend HTTP API, domain verified in Resend)
 *
 * In both cases:
 *   MAIL_FROM        - "Display Name <mailbox@domain>"
 *   FOUNDER_CC_EMAIL - CCed so a copy always reaches the founder
 */

export interface EmailAttachment {
  filename: string;
  /** PDF or other binary payload. Encoded base64 on the way to Resend. */
  content: Buffer;
  contentType?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
  tag?: string;
  /** Files attached to the message. Both transports support this. */
  attachments?: EmailAttachment[];
}

type Transport = "smtp" | "resend" | "none";

function pickTransport(): Transport {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM) return "smtp";
  if (env.RESEND_API_KEY && env.MAIL_FROM) return "resend";
  return "none";
}

export function emailEnabled(): boolean {
  return pickTransport() !== "none";
}

// nodemailer transporter created lazily once; reused across sends. A
// pool connection cuts the TLS handshake on repeated emails from 150ms
// to one-digit ms.
let smtpTransporter: Transporter | null = null;
function getSmtpTransporter(): Transporter {
  if (!smtpTransporter) {
    const port = env.SMTP_PORT ?? 587;
    // STARTTLS on 587, direct TLS on 465. Honour an explicit override.
    const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465;
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port,
      secure,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! },
      pool: true,
      maxConnections: 2,
    });
  }
  return smtpTransporter;
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const transport = pickTransport();
  if (transport === "none") {
    console.log(`[email] skipped (no transport configured): to=${message.to} subj="${message.subject}"`);
    return false;
  }

  // Resolve the full CC list once, used by both transports.
  const cc = [...(message.cc ?? [])];
  if (env.FOUNDER_CC_EMAIL && env.FOUNDER_CC_EMAIL !== message.to) cc.push(env.FOUNDER_CC_EMAIL);

  if (transport === "smtp") {
    try {
      const info = await getSmtpTransporter().sendMail({
        from: env.MAIL_FROM,
        to: message.to,
        cc: cc.length ? cc : undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: message.tag ? { "X-Entity-Ref-ID": message.tag } : undefined,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType ?? "application/pdf",
        })),
      });
      console.log(`[email] sent via smtp: to=${message.to} id=${info.messageId}`);
      return true;
    } catch (err) {
      console.warn(`[email] smtp send failed: ${(err as Error).message}`);
      return false;
    }
  }

  // Resend HTTP path.
  const body: Record<string, unknown> = {
    from: env.MAIL_FROM,
    to: [message.to],
    subject: message.subject,
    text: message.text,
  };
  if (message.html) body.html = message.html;
  if (cc.length) body.cc = cc;
  if (message.tag) body.tags = [{ name: "stream", value: message.tag }];
  if (message.attachments?.length) {
    body.attachments = message.attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
      content_type: a.contentType ?? "application/pdf",
    }));
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[email] resend send failed: ${response.status} ${text.slice(0, 200)}`);
      return false;
    }
    console.log(`[email] sent via resend: to=${message.to}`);
    return true;
  } catch (err) {
    console.warn(`[email] resend send threw: ${(err as Error).message}`);
    return false;
  }
}

// ── Template: welcome a newly-provisioned clinic ─────────────────────

export interface WelcomeContext {
  clinicName: string;
  ownerEmail: string;
  ownerPassword: string;
  portalUrl: string;
  publicSiteUrl: string;
  apiHost: string | null;
  tlsOk: boolean;
}

export function buildWelcomeEmail(ctx: WelcomeContext): EmailMessage {
  const tlsWarning = ctx.tlsOk
    ? ""
    : "\nIMPORTANT: a TLS certificate has not yet been issued for your clinic's API hostname, so the site will refuse to load until we finish that step. We have been notified.\n";

  const text = [
    `Hello,`,
    ``,
    `Your clinic "${ctx.clinicName}" is set up on Nayaversse.`,
    ``,
    `Where to work:`,
    `  Staff portal:        ${ctx.portalUrl}`,
    `  Public patient site: ${ctx.publicSiteUrl}`,
    ``,
    `Your first sign-in:`,
    `  Email:    ${ctx.ownerEmail}`,
    `  Password: ${ctx.ownerPassword}`,
    ``,
    `Change this password the first time you sign in. We do not keep a`,
    `copy, so if you lose it there is a reset flow but we cannot recover`,
    `the one above.`,
    ``,
    tlsWarning,
    `If anything looks wrong, reply to this email and we will look at it`,
    `with you.`,
    ``,
    `--`,
    `Nayaversse`,
  ].filter((l) => l !== null).join("\n");

  // One opinionated HTML version. Plain, high-contrast, readable on a
  // phone. No images, no tracking pixels, no footer boilerplate --
  // transactional, not marketing.
  const esc = (s: string) => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(ctx.clinicName)} is set up</title></head>
<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;line-height:1.55;color:#101012;max-width:560px;margin:24px auto;padding:0 20px;">
  <h2 style="font-weight:600;letter-spacing:-0.01em;margin:0 0 16px;">Your clinic "${esc(ctx.clinicName)}" is live on Nayaversse</h2>
  <p>Welcome. Here is everything you need for your first sign-in.</p>

  <h3 style="margin:28px 0 8px;font-size:15px;color:#555;text-transform:uppercase;letter-spacing:0.05em;">Where to work</h3>
  <p style="margin:6px 0;"><strong>Staff portal:</strong> <a href="${esc(ctx.portalUrl)}">${esc(ctx.portalUrl)}</a></p>
  <p style="margin:6px 0;"><strong>Public site:</strong> <a href="${esc(ctx.publicSiteUrl)}">${esc(ctx.publicSiteUrl)}</a></p>

  <h3 style="margin:28px 0 8px;font-size:15px;color:#555;text-transform:uppercase;letter-spacing:0.05em;">Your first sign-in</h3>
  <table style="border-collapse:collapse;margin:6px 0;">
    <tr><td style="padding:4px 12px 4px 0;color:#555;">Email</td><td style="font-family:ui-monospace,Menlo,monospace;">${esc(ctx.ownerEmail)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#555;">Password</td><td style="font-family:ui-monospace,Menlo,monospace;background:#f3eccf;padding:4px 8px;border-radius:4px;">${esc(ctx.ownerPassword)}</td></tr>
  </table>
  <p style="color:#555;font-size:13px;margin:12px 0 0;">Change this password the first time you sign in. We do not keep a copy, so if you lose it there is a reset flow but we cannot recover this one.</p>

  ${ctx.tlsOk ? "" : '<p style="margin:24px 0;padding:12px 14px;background:#fff6e5;border-left:3px solid #c88a0a;color:#6a4005;"><strong>One known issue:</strong> a TLS certificate is still being issued for your clinic\'s API hostname. The portal will not load until we finish that; we have been notified.</p>'}

  <p style="margin:28px 0 0;color:#555;font-size:13px;">If anything looks wrong, reply to this email and we will look at it with you.</p>
  <p style="margin:6px 0 0;color:#888;font-size:12px;">— Nayaversse</p>
</body></html>`;

  return {
    to: ctx.ownerEmail,
    subject: `${ctx.clinicName} is live on Nayaversse — your sign-in details`,
    text,
    html,
    tag: "provisioning-welcome",
  };
}

// ── Template: owner password reset ───────────────────────────────────

export interface ResetContext {
  clinicName: string;
  ownerEmail: string;
  newPassword: string;
  portalUrl: string;
}

export function buildResetEmail(ctx: ResetContext): EmailMessage {
  const text = [
    `Hello,`,
    ``,
    `We have reset the password for ${ctx.ownerEmail} on ${ctx.clinicName}.`,
    ``,
    `  Sign in: ${ctx.portalUrl}`,
    `  Email:   ${ctx.ownerEmail}`,
    `  Password: ${ctx.newPassword}`,
    ``,
    `Change this password the first time you sign in. We do not keep a`,
    `copy; the only way back if you lose it is another reset.`,
    ``,
    `If you did not ask for this reset, reply to this email at once.`,
    ``,
    `--`,
    `Nayaversse`,
  ].join("\n");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Password reset for ${esc(ctx.clinicName)}</title></head>
<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;line-height:1.55;color:#101012;max-width:560px;margin:24px auto;padding:0 20px;">
  <h2 style="font-weight:600;letter-spacing:-0.01em;margin:0 0 16px;">Password reset for ${esc(ctx.clinicName)}</h2>
  <p>We have reset the password for <strong>${esc(ctx.ownerEmail)}</strong>.</p>

  <table style="border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:4px 12px 4px 0;color:#555;">Sign in</td><td><a href="${esc(ctx.portalUrl)}">${esc(ctx.portalUrl)}</a></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#555;">Email</td><td style="font-family:ui-monospace,Menlo,monospace;">${esc(ctx.ownerEmail)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#555;">Password</td><td style="font-family:ui-monospace,Menlo,monospace;background:#f3eccf;padding:4px 8px;border-radius:4px;">${esc(ctx.newPassword)}</td></tr>
  </table>

  <p style="color:#555;font-size:13px;margin:12px 0 0;">Change this password the first time you sign in. We do not keep a copy; the only way back if you lose it is another reset.</p>

  <p style="margin:24px 0;padding:12px 14px;background:#fef2f2;border-left:3px solid #c62828;color:#8a1a1a;font-size:13px;">If you did not ask for this reset, reply to this email at once.</p>

  <p style="margin:6px 0 0;color:#888;font-size:12px;">— Nayaversse</p>
</body></html>`;

  return {
    to: ctx.ownerEmail,
    subject: `Password reset for ${ctx.clinicName}`,
    text,
    html,
    tag: "password-reset",
  };
}
