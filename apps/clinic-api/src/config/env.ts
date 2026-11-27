import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4100),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required -- see .env.example"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters -- see .env.example"),
  // This clinic's own Redis, holding its live sessions. Required:
  // without it there is no way to revoke access, and the default of a
  // missing session store is silently going back to tokens nobody can
  // cancel. render-compose.sh gives each clinic its own.
  REDIS_URL: z.string().min(1, "REDIS_URL is required -- see .env.example"),

  // Gates which route modules this deployment registers at boot, and how
  // many staff logins it allows -- see src/config/features.ts. One value
  // per deployment, set once in .env.
  CLINIC_PLAN: z.enum(["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"]).default("BASIC"),

  // Optional. Overrides the plan's seat cap in either direction, for a
  // deal that included extra logins. 0 means unlimited. Left unset, the
  // plan's own number applies, which is the normal case.
  CLINIC_MAX_USERS: z.coerce.number().int().min(0).max(500).optional(),

  // Optional. The exact modules this clinic has, comma-separated
  // ("billing,labs,pharmacy,cashcounter"), written by the provider console
  // after applying the plan and the deal's overrides. Unset, the plan
  // decides -- see src/config/features.ts for why older clinics keep
  // everything they already had.
  CLINIC_FEATURES: z.string().optional(),

  // Optional. Who a clinic asks when it wants a module its plan does not
  // include: shown on the "not in your plan" screen. A phone number, an
  // email address, or both, as the provider wants them shown.
  UPGRADE_CONTACT: z.string().max(200).optional(),

  // Optional. "1" makes the whole portal read-only: anything can be
  // looked at, nothing can be changed. Set by the provider console when
  // a clinic is suspended. Records are never deleted or hidden; a clinic
  // that has not paid can still read and export its patients' data.
  CLINIC_READ_ONLY: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),

  // Optional. "1" marks a demonstration deployment: made-up patients, reset
  // every night, and the only kind of database the demo reset script will
  // touch. Never set on a real clinic.
  CLINIC_DEMO: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),

  // Signing in on a second device ends the session on the first. On by
  // default: seats are what the plan sells, so one login being used by a
  // whole front desk is both a billing hole and an audit trail that
  // attributes everyone's actions to one person. A clinic that genuinely
  // needs one person on two devices turns it off here rather than sharing
  // a password.
  CLINIC_SINGLE_DEVICE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // Optional. Powers the "translate this page into Marathi" button on the
  // website builder. Deliberately optional: without either key the
  // translation editor still works fully by hand, and the public site
  // still serves whatever translations exist. Only the auto-draft step
  // needs a provider, so a deployment without one loses a convenience,
  // not a feature.
  //
  // Whichever key is present is used; ANTHROPIC wins if both are set,
  // unless TRANSLATION_PROVIDER says otherwise.
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  TRANSLATION_PROVIDER: z.enum(["anthropic", "gemini", "auto"]).default("auto"),

  // Master switch, independent of whether a key exists. A key can be
  // present for other purposes while a given clinic is on a plan that
  // doesn't include AI translation, or the owner simply wants to stop
  // spending on it. Set false and the auto-translate button disappears;
  // the hand-written editor keeps working exactly as before.
  AI_TRANSLATION_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // Which content classes may be auto-translated, comma-separated.
  // `clinic` is the site copy (tagline, services, FAQs -- short, cheap);
  // `post` is blog articles, which are long and are the bulk of the cost.
  // A deployment can allow the first and not the second.
  AI_TRANSLATABLE_NAMESPACES: z
    .string()
    .default("clinic,post")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),

  // Cost guard: the most items one translate run may send. A clinic with
  // forty blog posts should not be able to spend an unbounded amount on a
  // single accidental click.
  AI_TRANSLATION_MAX_ITEMS: z.coerce.number().int().min(1).max(2000).default(200),

  // Overridable so a deployment can move to a newer model without a code
  // change -- model names churn faster than this codebase will.
  ANTHROPIC_TRANSLATION_MODEL: z.string().default("claude-sonnet-5"),
  GEMINI_TRANSLATION_MODEL: z.string().default("gemini-2.5-flash"),
  // ── The clinic assistant (the `scribe` module) ──────────────────────
  //
  // Optional, like the translation keys above. Without SARVAM_API_KEY the
  // assistant cannot listen, and still structures notes that are typed or
  // pasted. Without ANTHROPIC_API_KEY it reads only what its own rules
  // can (numbers, medicines, tests, follow-up) and says so on the draft.
  //
  // Held back everywhere until this says "true": with it unset the
  // assistant is off on this deployment whatever the plan or the module
  // list says -- its routes are not registered and the portal shows no
  // trace of it. Switching it on for a clinic is this line set to "true"
  // plus "scribe" in CLINIC_FEATURES, then a restart.
  ASSISTANT_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SARVAM_API_KEY: z.string().optional(),
  // "unknown" lets the speech engine detect the language of each piece,
  // which is what a consultation that moves between three needs. Set a
  // code such as "mr-IN" only for a clinic that speaks one.
  SCRIBE_LANGUAGE: z.string().default("unknown"),
  // The small model on purpose: see lib/scribe/model.ts.
  SCRIBE_MODEL: z.string().default("claude-haiku-5-5"),
  // While listening, the note on screen is rebuilt by rule after every
  // piece of speech, which is free. This is how many seconds of new
  // speech pass between the rebuilds that also use the language model,
  // which is what writes the complaint and history as the doctor talks.
  // Lower is livelier and costs more; 0 uses the model only at the end.
  SCRIBE_LIVE_SECONDS: z.coerce.number().int().min(0).max(600).default(40),

  // When a consultation ends, also offer what else it called for: the
  // clinic's own forms, a family member to add, a certificate
  // (lib/assistant/propose.ts). One more model call, made only when the
  // consultation could contain one of those. "false" turns it off.
  SCRIBE_PROPOSE_ACTIONS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // Cost guards for the whole clinic, per day (lib/assistant/meter.ts).
  // Set well above a busy day's real use, so they are never met in
  // ordinary work and stop only a fault: a microphone left recording, a
  // script asking in a loop. Ten hours of speech; three thousand requests
  // that needed a model.
  ASSISTANT_DAILY_AUDIO_MINUTES: z.coerce.number().int().min(1).max(100_000).default(600),
  ASSISTANT_DAILY_MODEL_CALLS: z.coerce.number().int().min(1).max(1_000_000).default(3000),
  // The same, for one person: so that one login caught in a loop cannot
  // use up the clinic's day and switch the assistant off for everybody.
  ASSISTANT_USER_DAILY_AUDIO_MINUTES: z.coerce.number().int().min(1).max(100_000).default(300),
  ASSISTANT_USER_DAILY_MODEL_CALLS: z.coerce.number().int().min(1).max(1_000_000).default(800),

  // Cost guard: the longest one consultation may be listened to, in
  // minutes. A recording left running over lunch should stop on its own.
  SCRIBE_MAX_MINUTES: z.coerce.number().int().min(1).max(120).default(30),

  // Nayaverse Growth (Growth's D53): its address, and the key Growth gave
  // this clinic, for the "Open Nayaverse Growth" button in Settings. Both
  // empty hides the button.
  GROWTH_URL: z
    .string()
    .url()
    .refine((u) => /^https:\/\/([a-z0-9-]+\.)*nayaverse\.in(\/|$)/.test(u) || /^http:\/\/localhost(:\d+)?(\/|$)/.test(u), "GROWTH_URL must be https on nayaverse.in")
    .optional(),
  GROWTH_PARTNER_KEY: z.string().min(32, "GROWTH_PARTNER_KEY must be at least 32 characters").optional(),

  // Comma-separated origins allowed to call this API in production.
  // Ignored in development, where any origin is accepted so a Vite dev
  // server on any port works.
  CORS_ORIGINS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
