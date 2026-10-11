import { env } from "../config/env.js";

/**
 * Provisioning a new clinic: create the database, run its migrations, seed
 * it, and deploy the three sites.
 *
 * ## Dry run is the default, and stays the default until keys exist
 *
 * Without `NEON_API_KEY` / `VERCEL_TOKEN` every step reports exactly what
 * it *would* call and calls nothing. That is not a placeholder — it is the
 * safest possible default for code that creates billable infrastructure and
 * writes DNS, and it means the whole flow can be exercised end to end
 * before a single rupee is spent.
 *
 * A dry run is recorded in the activity log with `applied: false`, so a
 * rehearsal is never mistaken for the real thing when reading history back.
 *
 * ## The credential rule
 *
 * A clinic's `DATABASE_URL` is a key to that clinic's patient records. This
 * console **never persists one**. It is fetched from Neon at the moment it
 * is needed, handed to the migration step and to Vercel as a deployment
 * secret, and dropped. What we keep is the Neon project id, which is a
 * reference and useless alone.
 *
 * The practical consequence: a breach of this console is one API key to
 * rotate. Warehousing every clinic's database password here would make it a
 * single point of catastrophic failure across every patient of every
 * customer — which under the DPDP Act is the difference between an incident
 * and the end of the business.
 */

export type StepStatus = "ok" | "skipped" | "failed" | "dry-run";

export interface StepResult {
  key: string;
  label: string;
  status: StepStatus;
  detail: string;
  /** The call that would have been made, shown in dry run. */
  wouldCall?: string;
  durationMs?: number;
}

export interface ProvisionInput {
  slug: string;
  name: string;
  plan: string;
  features: string[];
  publicDomain?: string | null;
  portalDomain?: string | null;
  apiDomain?: string | null;
  adminEmail: string;
  adminName: string;
  /** Existing ids, when re-running against an already-provisioned clinic. */
  neonProjectId?: string | null;
  vercelWebProjectId?: string | null;
  vercelApiProjectId?: string | null;
}

export interface ProvisionOutcome {
  dryRun: boolean;
  steps: StepResult[];
  neonProjectId?: string;
  vercelWebProjectId?: string;
  vercelApiProjectId?: string;
  /** Shown to the operator ONCE, never stored. */
  adminPassword?: string;
}

export function provisioningAvailable(): { neon: boolean; vercel: boolean } {
  return { neon: Boolean(env.NEON_API_KEY), vercel: Boolean(env.VERCEL_TOKEN) };
}

export function isDryRun(): boolean {
  const { neon, vercel } = provisioningAvailable();
  return !neon || !vercel;
}

/** A password the clinic's first admin will actually be able to read out
 * over the phone, but that is still not guessable. */
export function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no l/1/o/0 — read aloud
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const pick = (i: number) => alphabet[bytes[i]! % alphabet.length];
  return [0, 1, 2, 3].map((g) => [0, 1, 2, 3].map((k) => pick(g * 4 + k)).join("")).join("-");
}

async function neonFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`https://console.neon.tech/api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NEON_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Neon ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function vercelFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const team = env.VERCEL_TEAM_ID ? `${path.includes("?") ? "&" : "?"}teamId=${env.VERCEL_TEAM_ID}` : "";
  const res = await fetch(`https://api.vercel.com${path}${team}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.VERCEL_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vercel ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Creates the Neon project and returns its connection string.
 *
 * The connection string is returned to the caller for immediate use and is
 * deliberately not written anywhere persistent.
 */
async function createNeonProject(input: ProvisionInput): Promise<{ projectId: string; connectionUri: string }> {
  const created = (await neonFetch("/projects", {
    method: "POST",
    body: JSON.stringify({
      project: {
        name: `clinic-${input.slug}`,
        region_id: "aws-ap-south-1", // Mumbai: these are Indian clinics
        ...(env.NEON_ORG_ID ? { org_id: env.NEON_ORG_ID } : {}),
      },
    }),
  })) as {
    project: { id: string };
    connection_uris?: { connection_uri: string }[];
  };

  const uri = created.connection_uris?.[0]?.connection_uri;
  if (!uri) throw new Error("Neon created the project but returned no connection string.");
  return { projectId: created.project.id, connectionUri: uri };
}

/** Re-reads a connection string for an existing project, so a redeploy
 * never needs one to have been stored. */
async function fetchNeonConnectionUri(projectId: string): Promise<string> {
  const data = (await neonFetch(`/projects/${encodeURIComponent(projectId)}/connection_uri?database_name=neondb&role_name=neondb_owner`)) as {
    uri?: string;
  };
  if (!data.uri) throw new Error(`Neon returned no connection string for project ${projectId}.`);
  return data.uri;
}

async function createVercelProject(name: string, rootDirectory: string): Promise<string> {
  const created = (await vercelFetch("/v11/projects", {
    method: "POST",
    body: JSON.stringify({
      name,
      framework: rootDirectory.includes("web") ? "vite" : null,
      rootDirectory,
      ...(env.DEPLOY_REPO
        ? { gitRepository: { type: "github", repo: env.DEPLOY_REPO } }
        : {}),
    }),
  })) as { id: string };
  return created.id;
}

async function setVercelEnv(projectId: string, vars: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(vars)) {
    await vercelFetch(`/v10/projects/${encodeURIComponent(projectId)}/env`, {
      method: "POST",
      body: JSON.stringify({
        key,
        value,
        type: key.endsWith("_SECRET") || key === "DATABASE_URL" ? "encrypted" : "plain",
        target: ["production"],
      }),
    });
  }
}

async function addVercelDomain(projectId: string, domain: string): Promise<void> {
  await vercelFetch(`/v10/projects/${encodeURIComponent(projectId)}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
}

/** A long random string, generated per clinic. Never reused across
 * deployments -- one leaked JWT secret must not mint tokens elsewhere. */
function generateJwtSecret(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Runs the whole provisioning sequence.
 *
 * Every step is attempted in order and its result recorded; a failure stops
 * the run rather than pressing on, because each step depends on the last
 * and a half-provisioned clinic is harder to reason about than a clearly
 * failed one.
 */
export async function provisionClinic(input: ProvisionInput): Promise<ProvisionOutcome> {
  const dryRun = isDryRun();
  const steps: StepResult[] = [];
  const outcome: ProvisionOutcome = { dryRun, steps };

  const adminPassword = generatePassword();
  const jwtSecret = generateJwtSecret();
  const apiUrl = input.apiDomain ? `https://${input.apiDomain}/api/clinic` : "";

  const run = async (
    key: string,
    label: string,
    wouldCall: string,
    fn: () => Promise<string>,
  ): Promise<boolean> => {
    const started = Date.now();
    if (dryRun) {
      steps.push({ key, label, status: "dry-run", detail: "Not executed — provisioning credentials are not configured.", wouldCall });
      return true;
    }
    try {
      const detail = await fn();
      steps.push({ key, label, status: "ok", detail, durationMs: Date.now() - started });
      return true;
    } catch (error) {
      steps.push({
        key,
        label,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
      });
      return false;
    }
  };

  // 1. Database -------------------------------------------------------------
  let connectionUri = "";
  const dbOk = await run(
    "database",
    "Create the clinic's database",
    `POST https://console.neon.tech/api/v2/projects  { name: "clinic-${input.slug}", region: aws-ap-south-1 }`,
    async () => {
      if (input.neonProjectId) {
        connectionUri = await fetchNeonConnectionUri(input.neonProjectId);
        outcome.neonProjectId = input.neonProjectId;
        return `Reused existing Neon project ${input.neonProjectId}.`;
      }
      const created = await createNeonProject(input);
      connectionUri = created.connectionUri;
      outcome.neonProjectId = created.projectId;
      return `Created Neon project ${created.projectId} in ap-south-1.`;
    },
  );
  if (!dbOk) return outcome;

  // 2. API project ----------------------------------------------------------
  const apiOk = await run(
    "api-project",
    "Create the API deployment",
    `POST https://api.vercel.com/v11/projects  { name: "clinic-${input.slug}-api", rootDirectory: "apps/clinic-api" }`,
    async () => {
      const id = input.vercelApiProjectId ?? (await createVercelProject(`clinic-${input.slug}-api`, "apps/clinic-api"));
      outcome.vercelApiProjectId = id;
      await setVercelEnv(id, {
        DATABASE_URL: connectionUri,
        JWT_SECRET: jwtSecret,
        CLINIC_PLAN: input.plan,
        NODE_ENV: "production",
      });
      if (input.apiDomain) await addVercelDomain(id, input.apiDomain);
      return `API project ${id} configured${input.apiDomain ? ` on ${input.apiDomain}` : ""}.`;
    },
  );
  if (!apiOk) return outcome;

  // 3. Web project ----------------------------------------------------------
  // One deployment serves both the patient site and the portal; which one a
  // visitor gets is decided from the hostname. See clinic-web/lib/site-mode.
  const webOk = await run(
    "web-project",
    "Create the website + portal deployment",
    `POST https://api.vercel.com/v11/projects  { name: "clinic-${input.slug}-web", rootDirectory: "apps/clinic-web" }  + domains ${[input.publicDomain, input.portalDomain].filter(Boolean).join(", ")}`,
    async () => {
      const id = input.vercelWebProjectId ?? (await createVercelProject(`clinic-${input.slug}-web`, "apps/clinic-web"));
      outcome.vercelWebProjectId = id;
      await setVercelEnv(id, { VITE_API_URL: apiUrl });
      // Both hostnames point at the same build -- that is the whole design.
      if (input.publicDomain) await addVercelDomain(id, input.publicDomain);
      if (input.portalDomain) await addVercelDomain(id, input.portalDomain);
      return `Web project ${id} configured for ${[input.publicDomain, input.portalDomain].filter(Boolean).join(" and ")}.`;
    },
  );
  if (!webOk) return outcome;

  // 4. Migrate + seed -------------------------------------------------------
  // Deliberately last: it needs the database to exist, and running it before
  // the deployments are configured would leave a populated database with
  // nothing serving it.
  await run(
    "migrate",
    "Create the tables and the first admin account",
    `prisma migrate deploy && tsx prisma/seed-clinic.ts  (against the new database)`,
    async () => {
      const { runClinicMigrations } = await import("./migrate-clinic.js");
      const result = await runClinicMigrations({
        databaseUrl: connectionUri,
        clinicName: input.name,
        adminEmail: input.adminEmail,
        adminName: input.adminName,
        adminPassword,
      });
      return result;
    },
  );

  outcome.adminPassword = adminPassword;
  return outcome;
}
