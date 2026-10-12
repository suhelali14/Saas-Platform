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

/** The runner must have checked in this recently for the queue to be
 *  considered live. Its timer fires every 15s, so two minutes allows
 *  for a slow provisioning run holding the lock. */
const HEARTBEAT_MAX_AGE_MS = 2 * 60 * 1000;

export type QueueHealth =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Whether a queued job would actually be picked up.
 *
 * Being able to create the directory is not enough. If the jobs
 * directory is not the same one the host runner watches -- because the
 * bind mount is missing -- then writing a job succeeds, the status file
 * is written into the container's own filesystem, and the console polls
 * it until the container restarts and it disappears. The operator sees
 * "Queued" forever and then 404s, with nothing anywhere saying why.
 *
 * So the test is not "can I write here" but "has the runner been here".
 * The runner touches a heartbeat on every run, including when idle, and
 * seeing that file proves both that it is alive and that it shares this
 * directory.
 */
export function queueHealth(): QueueHealth {
  try {
    mkdirSync(PENDING, { recursive: true });
    mkdirSync(STATUS, { recursive: true });
  } catch {
    return { ok: false, reason: "The provisioning job directory is not writable." };
  }

  const beat = path.join(JOBS_ROOT, ".runner-heartbeat");
  if (!existsSync(beat)) {
    return {
      ok: false,
      reason:
        "The provisioning runner has never checked in. Either it is not installed " +
        "(systemctl enable --now clinic-runner.timer) or the jobs directory is not " +
        "shared with the host, in which case a queued job would never be seen.",
    };
  }

  let age = Infinity;
  try {
    const seconds = Number(readFileSync(beat, "utf8").trim());
    if (Number.isFinite(seconds)) age = Date.now() - seconds * 1000;
  } catch {
    /* Treated as stale below. */
  }

  if (age > HEARTBEAT_MAX_AGE_MS) {
    const mins = Math.round(age / 60000);
    return {
      ok: false,
      reason: `The provisioning runner last checked in ${
        Number.isFinite(mins) ? `${mins} minute(s) ago` : "an unknown time ago"
      }. Check: systemctl status clinic-runner.timer`,
    };
  }

  return { ok: true };
}

/** Kept for callers that only need a yes or no. */
export function jobsAvailable(): boolean {
  return queueHealth().ok;
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
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    // A file that exists but cannot be read is a permissions fault, not
    // a missing job. Reporting it as missing sent a real ownership bug
    // to the console as a 404 and wasted the time it takes to tell
    // those apart.
    if (code === "EACCES" || code === "EPERM") {
      throw new Error(
        `Job ${id} exists but is not readable by this process. The runner must hand ` +
          `status files to the queue's owner -- check ownership of ${STATUS}.`,
      );
    }

    // Anything else is most likely a half-written file; the next poll
    // will find it complete.
    return null;
  }
}
