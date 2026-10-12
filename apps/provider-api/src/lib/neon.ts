import { env } from "../config/env.js";

/**
 * Creating a clinic's database.
 *
 * Extracted from provisioning.ts, which was written for an architecture
 * that deployed each clinic's API to Vercel. That is no longer how this
 * works -- clinic APIs are containers on our own server, because Vercel's
 * filesystem is ephemeral and patient scans would not survive it. Only
 * the Neon half of that module is still correct, so it lives here on its
 * own rather than behind a function that also talks to Vercel.
 */

const NEON_API = "https://console.neon.tech/api/v2";

/**
 * Where a clinic's database is created.
 *
 * Configurable because region availability is per-organisation, not
 * universal: this was hardcoded to Mumbai (aws-ap-south-1), which Neon
 * rejected with "requested region not found" for an account that simply
 * is not enabled for it. Singapore is the nearest region generally
 * available to Indian accounts and is the default.
 *
 * Set NEON_REGION to something closer if your organisation has it --
 * every patient lookup crosses this link, so a nearer region is worth
 * having when you can get one.
 */
const REGION = env.NEON_REGION;

export function neonConfigured(): boolean {
  return Boolean(env.NEON_API_KEY);
}

async function neonFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  if (!env.NEON_API_KEY) throw new Error("NEON_API_KEY is not set");

  const response = await fetch(`${NEON_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NEON_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    // Neon echoes the request back in some errors. The key is in the
    // header rather than the body, but the message is still trimmed --
    // this reaches an HTTP response and a log.
    const brief = text.slice(0, 300).replace(/\s+/g, " ");

    // The most likely 404 here is a region this organisation cannot
    // use, and Neon's message does not say which region was asked for.
    if (response.status === 404 && /region/i.test(brief)) {
      throw new Error(
        `Neon rejected the region "${REGION}". Region availability differs by organisation. ` +
          `Set NEON_REGION in the provider API's environment to one your account has -- ` +
          `the region of an existing project is a safe choice.`,
      );
    }

    throw new Error(`Neon ${response.status}: ${brief}`);
  }
  return text ? JSON.parse(text) : {};
}

type NeonProject = { projectId: string; connectionUri: string };

/**
 * Creates a project and returns its connection string.
 *
 * The string is returned to the caller and never persisted here. What
 * gets stored against the account is the project id, which is a
 * reference and useless on its own -- so a breach of this console is one
 * API key to rotate rather than every clinic's patient records.
 */
export async function createNeonProjectForClinic(slug: string): Promise<NeonProject> {
  const created = (await neonFetch("/projects", {
    method: "POST",
    body: JSON.stringify({
      project: {
        name: `clinic-${slug}`,
        region_id: REGION,
        pg_version: 16,
      },
    }),
  })) as {
    project?: { id?: string };
    connection_uris?: { connection_uri?: string }[];
  };

  const projectId = created.project?.id;
  const connectionUri = created.connection_uris?.[0]?.connection_uri;

  if (!projectId) throw new Error("Neon did not return a project id");
  if (!connectionUri) throw new Error("Neon did not return a connection string");

  return { projectId, connectionUri };
}

/**
 * Deletes a project. Used when provisioning fails after the database was
 * created, so a retry does not leave an orphan behind -- Neon's free
 * tier allows 100 projects and a failed run should not consume one
 * permanently.
 */
export async function deleteNeonProject(projectId: string): Promise<void> {
  await neonFetch(`/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
}
