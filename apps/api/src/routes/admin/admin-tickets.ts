import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth } from "../../plugins/auth.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";

// Platform trust layer -- admin-side support tickets (docs/plans platform-trust-layer).

const updateTicketSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedAdminId: z.string().nullable().optional(),
});

const replySchema = z.object({ content: z.string().min(1).max(5000) });

export async function adminTicketRoutes(app: FastifyInstance) {
  app.get("/api/admin/tickets", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const { page, limit, skip } = getPaginationParams(query);
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.priority) where.priority = query.priority;

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: { business: { select: { id: true, name: true } }, assignedAdmin: { select: { id: true, name: true } } },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return createPaginatedResult(items, total, page, limit);
  });

  app.get("/api/admin/tickets/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        business: { select: { id: true, name: true, email: true, phone: true } },
        assignedAdmin: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!ticket) return reply.status(404).send({ error: "Not found" });
    return ticket;
  });

  app.patch("/api/admin/tickets/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = updateTicketSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.ticket.update({ where: { id }, data: parsed.data });
    return updated;
  });

  app.post("/api/admin/tickets/:id/messages", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return reply.status(404).send({ error: "Not found" });

    const parsed = replySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: auth.adminId } });

    const [message] = await Promise.all([
      prisma.ticketMessage.create({
        data: { ticketId: id, senderType: "ADMIN", senderName: admin?.name ?? "Support", content: parsed.data.content },
      }),
      // An admin reply naturally moves an untouched ticket into progress --
      // doesn't force it, so an admin can still reply on a ticket they're
      // deliberately leaving OPEN for another admin to pick up.
      prisma.ticket.update({
        where: { id },
        data: { status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status, updatedAt: new Date() },
      }),
    ]);

    return reply.status(201).send(message);
  });
}
