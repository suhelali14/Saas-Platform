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
});

export const env = envSchema.parse(process.env);
