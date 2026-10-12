import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from "node:fs";
import path from "node:path";

/**
 * Asks the host to provision a clinic, without being able to touch it.
 *
 * This process runs in a container. Giving it the Docker socket so it
 * could start a clinic's API would be root on the host, granted to a
 * service that faces the internet and holds the Neon API key -- a flaw
 * here would become a full compromise of a machine holding patient
 * records.
 *
 * So it writes a job file instead, and a root service on the host
 * (deploy/clinic-runner.sh) picks it up. The only thing this can ask for
 * is a clinic: the job carries a slug, a name and a connection string,
 * never a command. The runner validates all three again before acting,
 * because a value that arrived over HTTP should not be trusted twice.
 */

const JOBS_ROOT = process.env.JOBS_DIR ?? "/srv/clinic/jobs";
const PENDING = path.join(JOBS_ROOT, "pending");
const STATUS = path.join(JOBS_ROOT, "status");

export type JobState = "queued" | "running" | "succeeded" | "failed";

export type JobStatus = {
  id: string;
  state: JobState;
  message: string;
  updatedAt: string;
  /** Present only on success, and only until the operator reloads. */
  password?: string;
  loginEmail?: string;
  apiHost?: string;
};

export type ProvisionRequest = {
  slug: string;
  name: string;
  doctorName: string;
  doctorEmail: string;
  plan: "BASIC" | "STANDARD" | "PREMIUM";
  databaseUrl: string;
};

/** True when the jobs directory is mounted, i.e. this deployment can
 *  provision at all. A console without it still works for everything
 *  else, and says so rather than failing at the moment of use. */
export function jobsAvailable(): boolean {
  try {
    mkdirSync(PENDING, { recursive: true });
    mkdirSync(STATUS, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function enqueueProvision(req: ProvisionRequest): string {
  if (!jobsAvailable()) {
    throw new Error("The provisioning job directory is not mounted; this console cannot provision.");
  }

  const id = randomUUID();
  const payload = JSON.stringify({ ...req, requestedAt: new Date().toISOString() }, null, 2);

  // Written to a temporary name and renamed into place. The runner polls
  // this directory, and a rename is atomic -- writing directly would let
  // it read a half-written file and reject a valid job.
  const tmp = path.join(PENDING, `.${id}.tmp`);
  const final = path.join(PENDING, `${id}.json`);
  writeFileSync(tmp, payload, { mode: 0o600 });
  renameSync(tmp, final);

  // Seed a status so the console has something to show immediately,
  // rather than a gap until the runner's next poll.
  writeFileSync(
    path.join(STATUS, `${id}.json`),
    JSON.stringify({
      id,
      state: "queued",
      message: `Queued ${req.name}`,
      updatedAt: new Date().toISOString(),
    }),
    { mode: 0o600 },
  );

  return id;
}

export function readJobStatus(id: string): JobStatus | null {
  // The id goes into a path, and it arrives from a URL. Anything but a
  // uuid is refused rather than normalised.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const file = path.join(STATUS, `${id}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as JobStatus;
  } catch {
    // A partially written file; the next poll will find it complete.
    return null;
  }
}
