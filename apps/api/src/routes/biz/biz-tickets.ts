import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TicketCategory } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";

// Platform trust layer -- business-side support tickets
// (docs/plans platform-trust-layer).

const createTicketSchema = z.object({
  category: z.nativeEnum(TicketCategory),
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
});

const replySchema = z.object({ content: z.string().min(1).max(5000) });

export async function bizTicketRoutes(app: FastifyInstance) {
  app.get("/api/biz/tickets", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { page, limit, skip } = getPaginationParams(request.query as Record<string, string>);
    const where = { businessId: auth.businessId };

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take: limit }),
      prisma.ticket.count({ where }),
    ]);

    return createPaginatedResult(items, total, page, limit);
  });

  app.post("/api/biz/tickets", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = createTicketSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const businessUser = await prisma.businessUser.findUnique({ where: { id: auth.businessUserId } });

    const ticket = await prisma.ticket.create({
      data: {
        businessId: auth.businessId,
        raisedByBusinessUserId: auth.businessUserId,
        category: parsed.data.category,
        subject: parsed.data.subject,
        description: parsed.data.description,
        messages: {
          create: [{ senderType: "BUSINESS", senderName: businessUser?.name ?? "Business", content: parsed.data.description }],
        },
      },
      include: { messages: true },
    });
    return reply.status(201).send(ticket);
  });

  app.get("/api/biz/tickets/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const ticket = await prisma.ticket.findFirst({
      where: { id, businessId: auth.businessId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) return reply.status(404).send({ error: "Not found" });
    return ticket;
  });

  app.post("/api/biz/tickets/:id/messages", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const ticket = await prisma.ticket.findFirst({ where: { id, businessId: auth.businessId } });
    if (!ticket) return reply.status(404).send({ error: "Not found" });
    if (ticket.status === "CLOSED") return reply.status(400).send({ error: "This ticket is closed" });

    const parsed = replySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const businessUser = await prisma.businessUser.findUnique({ where: { id: auth.businessUserId } });

    const [message] = await Promise.all([
      prisma.ticketMessage.create({
        data: { ticketId: id, senderType: "BUSINESS", senderName: businessUser?.name ?? "Business", content: parsed.data.content },
      }),
      // A business reply on a resolved ticket reopens it -- otherwise a
      // follow-up question would sit unseen on a ticket marked done.
      prisma.ticket.update({
        where: { id },
        data: { status: ticket.status === "RESOLVED" ? "OPEN" : ticket.status, updatedAt: new Date() },
      }),
    ]);

    return reply.status(201).send(message);
  });
}
