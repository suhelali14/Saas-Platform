import { prisma } from "./prisma.js";
import { readJobStatus, type JobStatus } from "./provision-jobs.js";
import { deleteNeonProject } from "./neon.js";

/**
 * Writes a finished provisioning job back onto the account.
 *
 * The runner carries out the work on the host and records the outcome
 * in a status file. Nothing was reading that back into the database, so
 * a clinic could be fully provisioned -- container healthy, certificate
 * issued, patients able to load the site -- while the console still
 * showed it as never provisioned, with every automated step unticked.
 *
 * That was not only cosmetic. `provisionedAt` is what stops a second
 * attempt, so leaving it null let the same clinic be provisioned again,
 * and each attempt created another database before the host refused the
 * duplicate slug. Three attempts, three Neon projects, two of them
 * orphans nobody would ever find.
 *
 * Reconciliation happens on read rather than on a webhook: the console
 * polls while it is open, and anyone opening the clinic later fixes it
 * too. A tab closed at the wrong moment cannot leave the record wrong
 * forever.
 */
export async function reconcileJob(
  accountId: string,
  jobId: string,
): Promise<JobStatus | null> {
  const status = readJobStatus(jobId);
  if (!status) return null;

  if (status.state === "succeeded") {
    await applySuccess(accountId, status);
  } else if (status.state === "failed") {
    await cleanUpFailure(accountId, jobId);
  }

  return status;
}

async function applySuccess(accountId: string, status: JobStatus): Promise<void> {
  const account = await prisma.clinicAccount.findUnique({ where: { id: accountId } });
  if (!account || account.provisionedAt) return; // Already recorded.

  await prisma.clinicAccount.update({
    where: { id: accountId },
    data: {
      provisionedAt: new Date(),
      // The runner is the authority on where the API actually answers;
      // it configured nginx and requested the certificate for it.
      apiDomain: status.apiHost ?? account.apiDomain,
      // LIVE when the operator was in the middle of onboarding, otherwise
      // the status the operator set. An earlier version parked the
      // account in ONBOARDING here, on the reasoning that somebody still
      // had to hand the password over -- but that left the tenant
      // directory refusing to serve it, so the operator would click
      // "Provision", wait, see "Provisioned" in the console, open the
      // clinic's URL and get "No clinic at this address". A clinic
      // reachable to patients is live by every definition that matters
      // to them; the handover is an onboarding step row, not a reason to
      // withhold the service.
      //
      // A clinic the operator deliberately held as a LEAD, SUSPENDED,
      // or CHURNED keeps its status: promoting them would quietly
      // override a billing or sales decision.
      status: account.status === "ONBOARDING" ? "LIVE" : account.status,
    },
  });

  // Tick the steps the runner actually performed, and only those. The
  // manual ones stay open because nobody has done them.
  await prisma.onboardingStep.updateMany({
    where: { accountId, key: { in: ["database", "api-project", "migrate"] }, done: false },
    data: { done: true, doneAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      accountId,
      actorName: "provisioning runner",
      action: "provision.succeeded",
      detail: status.apiHost ? `api ${status.apiHost}` : null,
    },
  });
}

/**
 * Removes the database a failed attempt created.
 *
 * The project is made before the job is queued, because that is where
 * the Neon key lives. If the host then refuses the job, that database
 * is an orphan: it counts against the hundred-project free tier and
 * nothing references it.
 *
 * Only ever removes a project belonging to an account that was never
 * provisioned, so a live clinic's database cannot be deleted by a later
 * failed retry.
 */
async function cleanUpFailure(accountId: string, jobId: string): Promise<void> {
  const account = await prisma.clinicAccount.findUnique({ where: { id: accountId } });
  if (!account || account.provisionedAt || !account.neonProjectId) return;

  const alreadyHandled = await prisma.activityLog.findFirst({
    where: { accountId, action: "provision.cleaned", detail: { contains: jobId } },
  });
  if (alreadyHandled) return;

  const projectId = account.neonProjectId;
  try {
    await deleteNeonProject(projectId);
  } catch {
    // Leaving a note is more useful than failing the request: the
    // operator can remove it by hand, and the reference is recorded
    // either way.
  }

  await prisma.clinicAccount.update({
    where: { id: accountId },
    data: { neonProjectId: null },
  });

  await prisma.activityLog.create({
    data: {
      accountId,
      actorName: "provisioning runner",
      action: "provision.cleaned",
      detail: `job ${jobId}: removed unused database ${projectId}`,
    },
  });
}
