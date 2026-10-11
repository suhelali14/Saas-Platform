/**
 * Business Booking Routes — Phase A: Transaction Rail
 *
 * GET /api/biz/bookings          List bookings for this business
 * GET /api/biz/bookings/stats    Counts by status
 * GET /api/biz/bookings/:id      Booking detail
 * PUT /api/biz/bookings/:id/status  Accept / Decline / Complete
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { confirmBooking } from "../../lib/booking-flywheel.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";

const statusUpdateSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED", "IN_PROGRESS"]),
  notes: z.string().max(500).optional(),
});

export async function bizBookingRoutes(app: FastifyInstance) {
  /**
   * GET /api/biz/bookings/stats
   * Quick counts for the dashboard badge + top stat cards.
   * Must be registered BEFORE /api/biz/bookings/:id or Fastify will treat
   * "stats" as an :id param.
   */
  app.get("/api/biz/bookings/stats", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { businessId } = auth;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const [pending, confirmed, completedToday, revenueToday] = await Promise.all([
      prisma.booking.count({ where: { businessId, status: "PENDING" } }),
      prisma.booking.count({ where: { businessId, status: "CONFIRMED" } }),
      prisma.booking.count({
        where: { businessId, status: "COMPLETED", updatedAt: { gte: today, lt: tomorrow } },
      }),
      prisma.booking.aggregate({
        where: {
          businessId,
          status: "COMPLETED",
          paymentMode: "RAZORPAY",
          updatedAt: { gte: today, lt: tomorrow },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      pending,
      confirmed,
      completedToday,
      revenueToday: revenueToday._sum.amount ?? 0, // paise
    };
  });

  /**
   * GET /api/biz/bookings
   * Paginated bookings list for this business, filterable by status.
   */
  app.get("/api/biz/bookings", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { businessId } = auth;
    const query = request.query as Record<string, string>;
    const { page, limit, skip } = getPaginationParams(query);
    const status = query.status as string | undefined;

    const where = {
      businessId,
      ...(status ? { status: status as any } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          offer: { select: { id: true, description: true } },
        },
        orderBy: { scheduledAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    // Anonymize guest consumers (no email/phone) for privacy.
    const sanitized = items.map((b) => ({
      ...b,
      user: {
        id: b.user.id,
        name: b.user.name ?? "Guest",
        email: b.user.email,
        phone: b.user.phone,
      },
    }));

    return createPaginatedResult(sanitized, total, page, limit);
  });

  /**
   * GET /api/biz/bookings/:id
   * Full booking detail including flywheel IDs.
   */
  app.get("/api/biz/bookings/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { businessId } = auth;
    const { id } = request.params as { id: string };

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        offer: { select: { id: true, description: true, price: true } },
        review: { select: { rating: true, text: true, createdAt: true } },
      },
    });

    if (!booking || booking.businessId !== businessId) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    return booking;
  });

  /**
   * PUT /api/biz/bookings/:id/status
   * Accept (→ CONFIRMED) / Decline (→ CANCELLED) / Complete (→ COMPLETED).
   *
   * On CONFIRMED for a pay-at-venue booking: runs the flywheel (creates
   * Customer + Appointment + Order) which is normally triggered by the
   * Razorpay webhook for online-payment bookings.
   */
  app.put("/api/biz/bookings/:id/status", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { businessId } = auth;
    const { id } = request.params as { id: string };

    const parsed = statusUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { status, notes } = parsed.data;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.businessId !== businessId) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    // Prevent nonsensical transitions.
    const allowedTransitions: Record<string, string[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!allowedTransitions[booking.status]?.includes(status)) {
      return reply
        .status(400)
        .send({ error: `Cannot transition from ${booking.status} to ${status}` });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status,
        ...(notes ? { notes } : {}),
      },
    });

    // For pay-at-venue bookings, business accept triggers the flywheel
    // (same as the Razorpay webhook does for online payments).
    if (status === "CONFIRMED" && booking.paymentMode === "PAY_AT_VENUE" && !booking.businessOrderId) {
      confirmBooking(id).catch((err) =>
        console.error("[biz-bookings] flywheel failed on manual accept:", err),
      );
    }

    // Flag for manual refund review if a paid booking is cancelled.
    if (status === "CANCELLED" && booking.razorpayPaymentId) {
      console.warn(
        `[biz-bookings] Cancelled booking ${id} had Razorpay payment ${booking.razorpayPaymentId}. Manual refund required.`,
      );
    }

    return updated;
  });
}
