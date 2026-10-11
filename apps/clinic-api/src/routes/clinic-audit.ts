import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../plugins/auth.js";

/**
 * Audit trail, read-only.
 *
 * There is deliberately no POST, PUT, PATCH or DELETE here. Entries are
 * written only by the central `onResponse` hook in `plugins/auth.ts`, and
 * nothing in the API can alter or remove one. A log staff can edit is not
 * an audit trail, and "we can prove nobody could have tampered with it" is
 * the entire point of keeping one.
 *
 * Admin-gated: an access log is itself sensitive -- it reveals which staff
 * looked at which patients. Reception has no business reading it.
 */

const querySchema = z.object({
  patientId: z.string().optional(),
  clinicUserId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cursor: z.string().optional(),
});

export async function clinicAuditRoutes(app: FastifyInstance) {
  app.get("/api/clinic/audit", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { patientId, clinicUserId, action, resource, from, to, limit, cursor } = parsed.data;

    const where: Record<string, unknown> = {};
    if (patientId) where.patientId = patientId;
    if (clinicUserId) where.clinicUserId = clinicUserId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (from || to) {
      const at: Record<string, Date> = {};
      if (from) at.gte = new Date(from);
      // `to` is a calendar day from a date picker; include the whole day
      // rather than stopping at its midnight boundary, which would silently
      // exclude everything that happened on the end date itself.
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        at.lte = end;
      }
      where.at = at;
    }

    // Fetch one extra row to tell "there is another page" from "this is
    // exactly the last page" without a second count query.
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const entries = hasMore ? rows.slice(0, limit) : rows;

    return {
      entries,
      nextCursor: hasMore ? (entries[entries.length - 1]?.id ?? null) : null,
    };
  });

  /** Who accessed one patient's record -- the question an auditor actually
   * asks, served straight off the `(patientId, at)` index. */
  app.get("/api/clinic/patients/:id/access-log", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const entries = await prisma.auditLog.findMany({
      where: { patientId: id },
      orderBy: { at: "desc" },
      take: 100,
    });
    return { entries };
  });

  /** Distinct values for the filter dropdowns, so the UI never offers a
   * filter that would return nothing. */
  app.get("/api/clinic/audit/filters", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const [actions, resources, users] = await Promise.all([
      prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
      prisma.auditLog.findMany({ distinct: ["resource"], select: { resource: true }, orderBy: { resource: "asc" } }),
      prisma.clinicUser.findMany({ select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    ]);

    return {
      actions: actions.map((a) => a.action),
      resources: resources.map((r) => r.resource),
      users,
    };
  });
}
