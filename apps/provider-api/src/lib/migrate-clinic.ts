import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Runs a freshly-created clinic database up to date and seeds its first
 * admin account.
 *
 * Shells out to the clinic app's own `prisma migrate deploy` and seed
 * script rather than reimplementing either here. That matters: a second
 * copy of the migration logic in the provider console would drift from the
 * clinic's real migrations, and the first symptom would be a customer's
 * database subtly disagreeing with the code serving it.
 *
 * `DATABASE_URL` is passed through the child's environment and never
 * written to disk, logged, or returned.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLINIC_API_DIR = path.resolve(HERE, "../../../clinic-api");

interface MigrateInput {
  databaseUrl: string;
  clinicName: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

function run(command: string, args: string[], extraEnv: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: CLINIC_API_DIR,
      env: { ...process.env, ...extraEnv },
      shell: process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += String(d); });
    child.stderr.on("data", (d) => { stderr += String(d); });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(stdout);
      // The database URL can appear in Prisma's error output. Strip it
      // before this reaches a log or an HTTP response.
      const safe = redact(`${stdout}\n${stderr}`, extraEnv.DATABASE_URL ?? "");
      reject(new Error(`${command} ${args.join(" ")} exited ${code}: ${safe.slice(-600)}`));
    });
  });
}

/** Removes a secret from text, and any postgres URL that looks like one. */
function redact(text: string, secret: string): string {
  let out = secret ? text.split(secret).join("[database-url-redacted]") : text;
  out = out.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database-url-redacted]");
  return out;
}

export async function runClinicMigrations(input: MigrateInput): Promise<string> {
  const childEnv = {
    DATABASE_URL: input.databaseUrl,
    CLINIC_SEED_NAME: input.clinicName,
    CLINIC_SEED_EMAIL: input.adminEmail,
    CLINIC_SEED_DOCTOR_NAME: input.adminName,
    CLINIC_SEED_PASSWORD: input.adminPassword,
  };

  const migrateOut = await run("npx", ["prisma", "migrate", "deploy"], childEnv);
  const applied = (migrateOut.match(/migration[s]? (?:have been )?applied/i) ? migrateOut : "")
    .split("\n")
    .filter((l) => l.trim().startsWith("└─") || l.includes("migrations found"))
    .length;

  await run("npx", ["tsx", "prisma/seed-clinic.ts"], childEnv);

  return `Migrations applied${applied ? ` (${applied} entries)` : ""}; clinic and first admin seeded.`;
}
