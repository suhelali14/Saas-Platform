import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import type { PlanTier } from "./plans.js";

/**
 * Inline provisioning.
 *
 * On a server with the host-side clinic-runner installed the usual flow
 * is correct: the console writes a job file, the runner picks it up,
 * creates the container, writes nginx, issues the certificate, and the
 * console polls until it succeeds. That keeps the Docker socket off a
 * container that faces the internet and holds the Neon API key.
 *
 * For every other case -- a local dev machine, a small single-server
 * deployment where the clinic APIs are managed elsewhere, a demo laptop
 * -- the runner is overkill and its absence is what makes the console
 * say "Queued" forever. This module is the alternate path.
 *
 * It does the one thing a one-click deployment actually needs: records
 * the clinic as provisioned and live, so the tenant directory starts
 * serving it. Database creation and migrations are left for the operator
 * (or for the queue path's Neon step), and so the onboarding checklist
 * steps for "database" and "migrate" are NOT ticked here -- the comment
 * is important, because if they were ticked the operator would look at
 * the checklist and think the schema was created when it was not, and
 * only find out from a Prisma "relation does not exist" on the first
 * sign-in.
 *
 * Only enabled by `PROVIDER_INLINE_PROVISION=1`. Nothing uses this on
 * a server that has the runner.
 */

export function inlineProvisioningEnabled(): boolean {
  return env.PROVIDER_INLINE_PROVISION === "1";
}

export interface InlineProvisionInput {
  accountId: string;
  slug: string;
  name: string;
  plan: PlanTier;
  /** The module list to record as applied. Written exactly as given; the
   *  caller resolves this against overrides because that is where the
   *  override decisions live. Passing an empty list switches every
   *  module off, which is how a tiny BASIC demo is configured. */
  features: string[];
  /** Where the clinic's API actually answers, if the operator knows.
   *  Falls back to the per-account apiDomain or the platform template
   *  when a template is configured. */
  apiHost?: string | null;
  /** The person starting the provisioning, for the activity log. */
  actor: { id: string; name: string };
}

export interface InlineProvisionOutcome {
  state: "succeeded";
  message: string;
  apiHost: string | null;
  /** The usual queue path returns a doctor password on success. Inline
   *  provisioning does not run the seed step, so none is returned here;
   *  the doctor signs in with the one the clinic was seeded with when it
   *  was first set up. */
  password?: never;
}

/**
 * Marks a clinic as provisioned and live, in the current process.
 *
 * The database is left exactly as it is. If NEON_API_KEY is set this
 * routine is NOT what runs the Neon create -- the caller does that
 * first, because the credential still belongs in exactly one place
 * (the Neon step in routes/provision.ts). This records the result.
 */
export async function inlineProvision(input: InlineProvisionInput): Promise<InlineProvisionOutcome> {
  const { accountId, slug, apiHost, features, actor } = input;

  const account = await prisma.clinicAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account disappeared mid-provision.");

  // The URL the directory hands to the browser. Preference order:
  // whatever the caller just learned (new deployment), the per-account
  // domain written for a custom one earlier, or the platform template.
  const resolvedApi = apiHost
    ?? account.apiDomain
    ?? (env.CLINIC_API_URL_TEMPLATE ? env.CLINIC_API_URL_TEMPLATE.replace(/\{slug\}/g, slug) : null);

  // The directory serves a clinic by its apiDomain, so when the URL came
  // from the platform template we record it here as well. Without this,
  // a later poll (through the synthetic inline-<id> job id) would read
  // apiDomain back and find it null, and the two responses would
  // disagree about where the clinic's API lives.
  const apiDomainToWrite = apiHost ?? account.apiDomain ?? resolvedApi;

  const alreadyProvisioned = Boolean(account.provisionedAt);

  // A clinic the operator deliberately held as a LEAD, SUSPENDED or
  // CHURNED keeps its status. The queue path's reconcile makes the same
  // decision; losing it here would quietly reactivate a suspended
  // clinic or promote a lead to a live customer.
  const nextStatus =
    account.status === "SUSPENDED" || account.status === "CHURNED" || account.status === "LEAD"
      ? account.status
      : "LIVE";

  // One transaction. Without this, the account update could succeed and
  // the activity log write fail -- leaving an account marked LIVE with
  // no record of who did it, and a provisionedAt that would stop the
  // next retry. Every provisionedAt write in this code base goes with
  // its own log line; keeping the two together is what makes that true.
  await prisma.$transaction([
    prisma.clinicAccount.update({
      where: { id: accountId },
      data: {
        provisionedAt: account.provisionedAt ?? new Date(),
        status: nextStatus,
        apiDomain: apiDomainToWrite,
        // What the clinic was told it is entitled to. Written from the
        // caller's list, so a feature override set on the account is
        // honoured (the caller resolved it). Mirrors what the queue
        // path writes for the same transition.
        appliedPlan: input.plan,
        appliedFeatures: features.join(","),
        appliedReadOnly: false,
        appliedAt: new Date(),
      },
    }),
    prisma.activityLog.create({
      data: {
        accountId,
        actorId: actor.id,
        actorName: actor.name,
        action: alreadyProvisioned ? "provision.inline.re-marked" : "provision.inline.succeeded",
        detail: resolvedApi ? `inline, api ${resolvedApi}` : "inline (no api url template set yet)",
      },
    }),
  ]);

  return {
    state: "succeeded",
    message: resolvedApi
      ? `${input.name} is live at ${resolvedApi}.`
      : `${input.name} is marked live. Set CLINIC_API_URL_TEMPLATE so the browser knows where its API lives, or set this clinic's apiDomain by hand.`,
    apiHost: resolvedApi,
  };
}

/**
 * The plain yes-or-no the provision route uses to decide which path to
 * take. Kept here so the route reads as "inline when it is on, queue
 * otherwise" without chasing a second call into env.
 */
export function shouldProvisionInline(): boolean {
  return inlineProvisioningEnabled();
}
