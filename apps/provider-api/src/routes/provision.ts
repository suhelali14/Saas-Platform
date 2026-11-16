import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireOwnerAuth, requireProviderAuth } from "../plugins/auth.js";
import { enqueueProvision, readJobStatus, queueHealth } from "../lib/provision-jobs.js";
import { reconcileJob } from "../lib/reconcile.js";
import { createNeonProjectForClinic, connectionUriFor, neonConfigured } from "../lib/neon.js";
import { validateSlug } from "../lib/subdomain.js";
import { resolveFeatures, type PlanTier } from "../lib/plans.js";
import { inlineProvision, shouldProvisionInline } from "../lib/inline-provision.js";

/**
 * One-click provisioning from the console.
 *
 * Split in two deliberately. This process creates the Neon project,
 * because it holds the Neon API key and nothing on the host should. It
 * then hands the connection string to a job that a root service on the
 * host carries out, because creating a container and writing nginx
 * config needs privileges this process must never have.
 *
 * The console polls the job rather than holding a request open: Neon,
 * Let's Encrypt and a container start together take longer than any
 * sensible HTTP timeout, and a dropped connection must not leave an
 * operator unsure whether a clinic was created.
 */
export async function provisionRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/provider/accounts/:id/provision-clinic",
    async (request, reply) => {
      // Owner only. This creates billable infrastructure.
      const auth = requireOwnerAuth(request, reply);
      if (!auth) return;

      // Two provisioning paths.
      //
      // The queue path is the normal one. It writes a job file for a
      // host-side runner that has the privileges the API container
      // deliberately does not (the Docker socket, root on nginx).
      //
      // The inline path is for setups where no such runner exists -- a
      // local dev machine, a small deployment where the clinic APIs
      // are managed elsewhere, a demo. There, going through the queue
      // only ever leaves the UI stuck at "Queued", and the operator
      // thinks the console is broken when it is doing exactly what
      // they told it to. PROVIDER_INLINE_PROVISION=1 switches to
      // marking the clinic live in this process instead.
      const inline = shouldProvisionInline();

      if (!inline) {
        // Refuse before creating anything. Queuing a job nobody will
        // pick up leaves the operator watching "Queued" forever -- and
        // in this case a Neon project would already have been created
        // and paid for by the time they gave up.
        const queue = queueHealth();
        if (!queue.ok) {
          return reply.status(503).send({ error: queue.reason });
        }
        if (!neonConfigured()) {
          return reply.status(503).send({
            error: "NEON_API_KEY is not set, so a database cannot be created.",
          });
        }
      }

      const account = await prisma.clinicAccount.findUnique({
        where: { id: request.params.id },
      });
      if (!account) return reply.status(404).send({ error: "Not found" });

      // The queue path needs these to seed the doctor's login; the
      // inline path does not, because the clinic is a running
      // deployment that was already seeded. So when inline mode is on
      // the fields are accepted but not required: "one click really
      // is one click" would be broken by a form that demanded them.
      const schema = inline
        ? z.object({ doctorName: z.string().max(120).optional(), doctorEmail: z.string().email().optional() })
        : z.object({ doctorName: z.string().min(2).max(120), doctorEmail: z.string().email() });
      const parsed = schema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      // The slug becomes a hostname, a filename and a container name.
      // Checked again here even though it was checked at creation: the
      // account could predate that rule.
      const check = validateSlug(account.slug);
      if (!check.ok) {
        return reply.status(400).send({ error: `Slug is unusable: ${check.reason}` });
      }

      if (account.provisionedAt) {
        return reply.status(409).send({
          error: `${account.name} was already provisioned. Remove it from the server before provisioning again.`,
        });
      }

      // ── Inline path: mark live in this process, return at once ─────
      if (inline) {
        const result = await inlineProvision({
          accountId: account.id,
          slug: account.slug,
          name: account.name,
          plan: account.plan as PlanTier,
          features: resolveFeatures(account.plan as PlanTier, account.featureOverrides),
          actor: { id: auth.id, name: auth.name },
        });
        // Same shape as a succeeded poll result, so the console's
        // existing JobProgress component renders it without changes.
        return reply.status(200).send({
          jobId: `inline-${account.id}`,
          state: result.state,
          message: result.message,
          apiHost: result.apiHost ?? undefined,
        });
      }

      // ── Queue path: Neon create here, container+nginx on the host ──

      // Create the database here, where the Neon key lives. Doing it in
      // the job would mean putting that key on the host as well, and it
      // can create and destroy every clinic's database.
      let databaseUrl: string;
      let neonProjectId: string;
      try {
        // Reuse the project a previous attempt created rather than
        // making another. Without this, each retry made a fresh
        // database before the host refused the duplicate slug -- three
        // attempts left three projects, two of them orphans.
        if (account.neonProjectId) {
          databaseUrl = await connectionUriFor(account.neonProjectId);
          neonProjectId = account.neonProjectId;
          request.log.info({ neonProjectId }, "reusing the database from a previous attempt");
        } else {
          const project = await createNeonProjectForClinic(account.slug);
          databaseUrl = project.connectionUri;
          neonProjectId = project.projectId;
        }
      } catch (error) {
        request.log.error({ err: error }, "neon project creation failed");
        return reply.status(502).send({
          error: `Could not create the database: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      }

      // The project id is a reference, not a credential. The connection
      // string is handed to the job and never stored here -- a breach of
      // this console is one API key to rotate, not every clinic's data.
      await prisma.clinicAccount.update({
        where: { id: account.id },
        data: { neonProjectId, status: "ONBOARDING" },
      });

      const provisionFeatures = resolveFeatures(account.plan as PlanTier, account.featureOverrides);
      // `inline` is false in this branch, so the schema was the required
      // one and both fields are present. TypeScript cannot see this
      // through the two schemas, so the assertion is spelled out.
      if (parsed.data.doctorName === undefined || parsed.data.doctorEmail === undefined) {
        return reply.status(400).send({ error: "Doctor name and email are required for queue provisioning." });
      }
      const jobId = enqueueProvision({
        slug: account.slug,
        name: account.name,
        doctorName: parsed.data.doctorName,
        doctorEmail: parsed.data.doctorEmail,
        plan: account.plan as "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE",
        demo: account.isDemo,
        features: provisionFeatures,
        databaseUrl,
        extraOrigins: [account.publicDomain, account.portalDomain]
          .filter((d): d is string => Boolean(d))
          .map((d) => `https://${d}`),
      });

      // The new clinic starts on exactly this list, written into its env
      // file, so the console knows what it runs from the first minute.
      await prisma.clinicAccount.update({
        where: { id: account.id },
        data: { appliedPlan: account.plan, appliedFeatures: provisionFeatures.join(","), appliedReadOnly: false, appliedAt: new Date() },
      });

      // actorName is denormalized on purpose: the entry has to still read
      // correctly after a team member leaves and their user row is gone.
      await prisma.activityLog.create({
        data: {
          accountId: account.id,
          actorId: auth.id,
          actorName: auth.name,
          action: "provision.queued",
          detail: `job ${jobId}`,
        },
      });

      return reply.status(202).send({ jobId, state: "queued" });
    },
  );

  app.get<{ Params: { jobId: string; accountId?: string } }>(
    "/api/provider/provision-jobs/:jobId",
    async (request, reply) => {
      // Any signed-in console user may watch a job they can see the
      // account for; only an owner could have started one.
      const auth = requireProviderAuth(request, reply);
      if (!auth) return;

      // The account id lets a finished job be written back onto the
      // record. Without it this is a read, which is why a closed tab
      // used to leave a provisioned clinic looking un-provisioned.
      const accountId = (request.query as { accountId?: string } | undefined)?.accountId;

      // Inline-mode runs returned a synthetic `inline-<accountId>` id
      // because no job was ever written to the queue. Looking it up as
      // a uuid against the status directory would 404, and the console
      // would poll until it gave up. Reading the account record back
      // reports what was actually done, whichever tab asks.
      //
      // The accountId must match the one in the id, so the synthetic
      // path cannot be used to look up an account by guessing its uuid
      // -- the caller already had to know it to construct this URL. The
      // normal /accounts/:id check applies through the usual route; this
      // is only the status of their own just-started provision.
      if (request.params.jobId.startsWith("inline-")) {
        const idFromJob = request.params.jobId.slice("inline-".length);
        if (!accountId || accountId !== idFromJob) {
          return reply.status(403).send({ error: "accountId must match the inline job id." });
        }
        const account = await prisma.clinicAccount.findUnique({
          where: { id: idFromJob },
          select: { id: true, name: true, apiDomain: true, provisionedAt: true, status: true },
        });
        if (!account || !account.provisionedAt) {
          return reply.status(404).send({ error: "Unknown job" });
        }
        return {
          id: request.params.jobId,
          state: "succeeded",
          message: `${account.name} is live.`,
          apiHost: account.apiDomain ?? undefined,
          updatedAt: account.provisionedAt.toISOString(),
        };
      }

      let status;
      try {
        status = accountId
          ? await reconcileJob(accountId, request.params.jobId)
          : readJobStatus(request.params.jobId);
      } catch (error) {
        // A readable-but-forbidden status file is a server
        // misconfiguration. Returned as 503 rather than thrown, because
        // the global handler makes every 5xx generic and this message
        // is the entire diagnosis.
        request.log.error({ err: error }, "job status unreadable");
        return reply.status(503).send({
          error: error instanceof Error ? error.message : "Job status is unreadable.",
        });
      }

      if (!status) return reply.status(404).send({ error: "Unknown job" });
      return status;
    },
  );
}
