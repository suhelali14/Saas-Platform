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

  // Gates which route modules this deployment registers at boot -- see
  // src/config/features.ts. One value per deployment, set once in .env.
  CLINIC_PLAN: z.enum(["BASIC", "STANDARD", "PREMIUM"]).default("BASIC"),

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
  // Comma-separated origins allowed to call this API in production.
  // Ignored in development, where any origin is accepted so a Vite dev
  // server on any port works.
  CORS_ORIGINS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
