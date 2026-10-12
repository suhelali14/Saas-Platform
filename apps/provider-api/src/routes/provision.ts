import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireOwnerAuth, requireProviderAuth } from "../plugins/auth.js";
import { enqueueProvision, readJobStatus, queueHealth } from "../lib/provision-jobs.js";
import { createNeonProjectForClinic, neonConfigured } from "../lib/neon.js";
import { validateSlug } from "../lib/subdomain.js";

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

      // Refuse before creating anything. Queuing a job nobody will pick
      // up leaves the operator watching "Queued" forever -- and in this
      // case a Neon project would already have been created and paid
      // for by the time they gave up.
      const queue = queueHealth();
      if (!queue.ok) {
        return reply.status(503).send({ error: queue.reason });
      }
      if (!neonConfigured()) {
        return reply.status(503).send({
          error: "NEON_API_KEY is not set, so a database cannot be created.",
        });
      }

      const account = await prisma.clinicAccount.findUnique({
        where: { id: request.params.id },
      });
      if (!account) return reply.status(404).send({ error: "Not found" });

      const parsed = z
        .object({
          doctorName: z.string().min(2).max(120),
          doctorEmail: z.string().email(),
        })
        .safeParse(request.body);
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

      // Create the database here, where the Neon key lives. Doing it in
      // the job would mean putting that key on the host as well, and it
      // can create and destroy every clinic's database.
      let databaseUrl: string;
      let neonProjectId: string;
      try {
        const project = await createNeonProjectForClinic(account.slug);
        databaseUrl = project.connectionUri;
        neonProjectId = project.projectId;
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

      const jobId = enqueueProvision({
        slug: account.slug,
        name: account.name,
        doctorName: parsed.data.doctorName,
        doctorEmail: parsed.data.doctorEmail,
        plan: account.plan as "BASIC" | "STANDARD" | "PREMIUM",
        databaseUrl,
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

  app.get<{ Params: { jobId: string } }>(
    "/api/provider/provision-jobs/:jobId",
    async (request, reply) => {
      // Any signed-in console user may watch a job they can see the
      // account for; only an owner could have started one.
      const auth = requireProviderAuth(request, reply);
      if (!auth) return;

      let status;
      try {
        status = readJobStatus(request.params.jobId);
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
