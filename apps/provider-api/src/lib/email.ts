import { env } from "../config/env.js";

/**
 * Transactional email through Resend (resend.com), by raw HTTP.
 *
 * Not the SDK: one more dependency for a tiny HTTP POST is not worth the
 * supply-chain surface for something a clinic signs up for. The Resend
 * API is stable, named fields, and has been unchanged for a year.
 *
 * Fail-open by design: if RESEND_API_KEY is not set, or the send fails,
 * we log and return false. The caller never throws on a failed email --
 * a clinic's provisioning is the real work; email is a notification on
 * top of it, and losing a notification is a smaller problem than
 * refusing to finish provisioning because an outbound HTTP call failed.
 *
 * Env:
 *   RESEND_API_KEY   - Resend API key. Without it this module is a no-op.
 *   MAIL_FROM        - e.g. "Nayaversse <no-reply@nayaversse.in>".
 *                      Domain must be verified in Resend.
 *   FOUNDER_CC_EMAIL - optional; CCed on every provisioning email so the
 *                      founder has a record even if the clinic deletes it.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
  tag?: string;
}

export function emailEnabled(): boolean {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!emailEnabled()) {
    // Soft announcement so a deploy that forgot the key still shows
    // in the log that an email would have gone out. One line per send,
    // not a stack trace.
    console.log(`[email] skipped (RESEND_API_KEY or MAIL_FROM unset): to=${message.to} subj="${message.subject}"`);
    return false;
  }

  const body: Record<string, unknown> = {
    from: env.MAIL_FROM,
    to: [message.to],
    subject: message.subject,
    text: message.text,
  };
  if (message.html) body.html = message.html;

  const cc = [...(message.cc ?? [])];
  if (env.FOUNDER_CC_EMAIL && env.FOUNDER_CC_EMAIL !== message.to) cc.push(env.FOUNDER_CC_EMAIL);
  if (cc.length) body.cc = cc;

  if (message.tag) body.tags = [{ name: "stream", value: message.tag }];

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(body),
      // The provider-api caller is already past the point of making the
      // clinic live; a slow email service should not stall its response.
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[email] send failed: ${response.status} ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[email] send threw: ${(err as Error).message}`);
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
