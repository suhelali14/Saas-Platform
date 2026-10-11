import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required — see .env.example"),

  // AI provider config -- see docs/10-tech-stack-decisions.md "Multi-provider
  // AI layer". AI_PROVIDER forces a choice; "auto" (default) uses whichever
  // provider has a key configured, preferring Anthropic if both do.
  AI_PROVIDER: z.enum(["auto", "anthropic", "gemini"]).default("auto"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.7-flash"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters — see .env.example"),

  // Optional -- biz-website's GitHub export gracefully no-ops (503) when unset.
  GITHUB_ACCESS_TOKEN: z.string().optional(),

  // Optional -- biz-whatsapp logs a "[WhatsApp DEMO]" line and no-ops when unset,
  // same graceful-degrade pattern as GITHUB_ACCESS_TOKEN above.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().default("businessos-whatsapp-verify"),
});

export const env = envSchema.parse(process.env);
