import { env } from "../config/env.js";

// Prisma's `?schema=` connection-string param only auto-qualifies the SQL
// *it* generates -- it does NOT set the real Postgres session's search_path.
// Any hand-written raw SQL (used sparingly, e.g. sequences, date-bucketed
// analytics aggregates Prisma's query builder can't express) must qualify
// its own table/sequence names, or it silently resolves against "public"
// instead of whatever schema this deployment's connection actually uses.
// Discovered the hard way in lib/uhid.ts -- centralized here so it's fixed
// once, not re-discovered per call site.
export function resolvedSchema(): string {
  try {
    return new URL(env.DATABASE_URL).searchParams.get("schema") || "public";
  } catch {
    return "public";
  }
}
