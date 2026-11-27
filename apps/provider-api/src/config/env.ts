import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4200),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required -- see .env.example"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),

  // Provisioning. All optional: without them the console runs in dry run,
  // which is the correct default for code that creates billable
  // infrastructure and writes DNS.
  NEON_API_KEY: z.string().optional(),
  // Where clinic databases are created.
  //
  // Neon has NO India region -- checked against its own regions page,
  // not inferred from one account. The AWS list is us-east-1/2,
  // us-west-2, eu-central-1, eu-west-2, ap-southeast-1, ap-southeast-2
  // and sa-east-1, and Azure is closed to new projects. Singapore is
  // the nearest to India and adds roughly 40-60 ms per query.
  //
  // Settable so a deployment elsewhere can pick its own, and so this
  // does not need a code change if Neon ever adds Mumbai.
  NEON_REGION: z.string().default("aws-ap-southeast-1"),
  NEON_ORG_ID: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional(),
  DEPLOY_REPO: z.string().optional(),

  // How often to ping each live clinic's /health. Zero disables it.
  HEALTH_POLL_MINUTES: z.coerce.number().min(0).max(1440).default(10),
  // Comma-separated origins allowed to call this API in production.
  // Ignored in development, where any origin is accepted so a Vite dev
  // server on any port works.
  CORS_ORIGINS: z.string().optional(),
  // The domain every clinic subdomain hangs off:
  //   <slug>.<PLATFORM_DOMAIN>         -> that clinic's patient website
  //   <slug>.portal.<PLATFORM_DOMAIN>  -> that clinic's staff portal
  // Used to generate the hostnames shown in the console and written to
  // each account at provisioning time.
  PLATFORM_DOMAIN: z.string().min(3).default("localhost"),
  /**
   * Older platform roots to also accept as the origin of a clinic
   * request (CORS only -- URL construction stays on PLATFORM_DOMAIN).
   * Comma-separated. Set this during a brand-rename so clinics still
   * served at the previous root keep answering, and remove it once
   * that root is retired.
   */
  PLATFORM_DOMAIN_ALIASES: z.string().optional().default(""),

  // Template for a clinic API's base URL, with {slug} substituted.
  // Each clinic keeps its OWN database and its OWN API deployment, so the
  // directory has to tell the browser which one to call. Falls back to a
  // per-account apiDomain when one is set, so a clinic on a custom domain
  // still works.
  CLINIC_API_URL_TEMPLATE: z.string().optional(),

  // Inline provisioning: on a server where the host-side clinic-runner
  // is not installed (small deployments, local dev), run the provision
  // step in this process and mark the clinic LIVE at once. The runner
  // model is still correct for larger setups -- it keeps the Docker
  // socket away from the internet-facing console -- so this stays off
  // by default. When on, "one click" in the console is really one
  // click: the clinic is reachable the moment the request returns.
  PROVIDER_INLINE_PROVISION: z.enum(["0", "1"]).default("0"),

  // ── Transactional email (optional; sends welcome messages on provision) ──
  // Without RESEND_API_KEY + MAIL_FROM set, email is a no-op -- every
  // provisioning still succeeds, there is just no outbound email. Add both
  // when the Resend domain is verified; see docs/WHERE-ENV-GOES.md.
  RESEND_API_KEY: z.string().optional(),
  // SMTP (any provider: GoDaddy, Office 365, Gmail, Resend SMTP, SES...).
  // If SMTP_HOST is set, SMTP is used; otherwise Resend if RESEND_API_KEY
  // is set; otherwise email is a no-op.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  /** true for port 465 (SMTPS), false for 587 (STARTTLS). Auto-picks by port if unset. */
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** e.g. `Nayaversse <no-reply@nayaversse.in>` -- must match the authenticated SMTP user's domain. */
  MAIL_FROM: z.string().optional(),
  /** CCed on every provisioning email so the founder always has a copy. Optional. */
  FOUNDER_CC_EMAIL: z.string().email().optional(),

  // ── Who Nayaversse's own invoices come from ─────────────────────────
  // Printed on every GST invoice the console issues. Until the GSTIN is
  // set, invoices can be drafted but not issued: a "tax invoice" with no
  // GSTIN on it is not one.
  PROVIDER_LEGAL_NAME: z.string().default("Nayaversse"),
  PROVIDER_ADDRESS: z.string().optional(),
  PROVIDER_GSTIN: z.string().optional(),
  // Two-digit GST state code of the provider's registration. Decides
  // CGST+SGST (same state) against IGST (any other). 27 is Maharashtra.
  PROVIDER_STATE_CODE: z.string().regex(/^\d{2}$/).default("27"),
  PROVIDER_EMAIL: z.string().optional(),
  PROVIDER_PHONE: z.string().optional(),
  // PREFIX/FY/0001. Kept short: GST caps an invoice number at 16 characters.
  INVOICE_PREFIX: z.string().max(6).default("NV"),
  INVOICE_DUE_DAYS: z.coerce.number().int().min(0).max(120).default(15),

  // ── Subscriptions for every product (src/lib/subscriptions.ts) ──────
  // off: nothing is sold here. test: a product's stand-in checkout marks a
  // subscription paid and the console renews it by itself; no money moves.
  // razorpay: real Razorpay subscriptions, monthly or yearly.
  SUBSCRIPTIONS_MODE: z.enum(["off", "test", "razorpay"]).default("off"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_BASE: z.string().url().default("https://api.razorpay.com/v1"),
  // Days a paid period stays open after its end, while a renewal is
  // charged and confirmed.
  SUBSCRIPTION_GRACE_DAYS: z.coerce.number().int().min(0).max(15).default(2),

  // ── Server-to-server (src/lib/s2s.ts) ───────────────────────────────
  // This console's private Ed25519 key (base64 PKCS#8), from
  // scripts/s2s-keygen.mjs. Its public half goes to each product.
  CONSOLE_SIGNING_KEY: z.string().optional(),
  // Nayaverse Growth: its address (e.g. https://uat.growth.nayaverse.in)
  // and its public key (base64 SPKI). Both empty: Growth is not connected.
  GROWTH_URL: z.string().url().optional(),
  GROWTH_PUBLIC_KEY: z.string().optional(),
}).superRefine((e, ctx) => {
  if (e.SUBSCRIPTIONS_MODE === "razorpay") {
    for (const k of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] as const) {
      if (!e[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: `SUBSCRIPTIONS_MODE=razorpay needs ${k}` });
    }
  }
  if (e.SUBSCRIPTIONS_MODE !== "off" && !e.CONSOLE_SIGNING_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["CONSOLE_SIGNING_KEY"], message: "Selling subscriptions needs CONSOLE_SIGNING_KEY to tell products what was paid" });
  }
});

export const env = envSchema.parse(process.env);
