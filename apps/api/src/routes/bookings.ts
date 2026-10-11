/**
 * Consumer Booking Routes — Phase A: Transaction Rail
 *
 * POST /api/bookings           Create a booking from a matched offer
 * GET  /api/bookings           Consumer's own booking history
 * GET  /api/bookings/:id       Single booking detail
 * POST /api/bookings/:id/pay   Initiate Razorpay payment
 * POST /api/payments/razorpay-webhook  Razorpay webhook (confirm payment)
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../plugins/auth.js";
import { confirmBooking } from "../lib/booking-flywheel.js";
import { getPaginationParams, createPaginatedResult } from "../lib/pagination.js";

// ─── Input Schemas ────────────────────────────────────────────────────────────

const createBookingSchema = z.object({
  offerId: z.string(),
  scheduledAt: z.string().datetime(), // ISO 8601
  durationMin: z.number().int().min(15).max(480).optional(),
  notes: z.string().max(500).optional(),
  paymentMode: z.enum(["PAY_AT_VENUE", "RAZORPAY"]).default("PAY_AT_VENUE"),
  matchId: z.string().optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function bookingRoutes(app: FastifyInstance) {
  /**
   * POST /api/bookings
   * Create a booking from a matched offer.
   */
  app.post("/api/bookings", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const parsed = createBookingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { offerId, scheduledAt, durationMin = 60, notes, paymentMode, matchId } = parsed.data;
    const scheduledDate = new Date(scheduledAt);

    // Validate future date.
    if (scheduledDate <= new Date()) {
      return reply.status(400).send({ error: "scheduledAt must be a future date" });
    }

    // Fetch offer + business to validate and snapshot the price.
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            intentlyEnabled: true,
            razorpayKeyId: true,
            // Never return keySecret to the client — only checked server-side.
          },
        },
      },
    });

    if (!offer) {
      return reply.status(404).send({ error: "Offer not found" });
    }
    if (!offer.business.intentlyEnabled) {
      return reply.status(400).send({ error: "This business is not accepting Intently bookings" });
    }

    // If consumer chose RAZORPAY but business hasn't set up keys, downgrade gracefully.
    const effectivePaymentMode =
      paymentMode === "RAZORPAY" && !offer.business.razorpayKeyId
        ? "PAY_AT_VENUE"
        : paymentMode;

    const booking = await prisma.booking.create({
      data: {
        userId,
        businessId: offer.businessId,
        offerId,
        matchId: matchId ?? undefined,
        scheduledAt: scheduledDate,
        durationMin,
        notes,
        amount: offer.price, // snapshot — price changes don't affect this booking
        currency: offer.currency,
        paymentMode: effectivePaymentMode,
        status: "PENDING",
      },
      include: {
        business: { select: { id: true, name: true, address: true, phone: true } },
        offer: { select: { id: true, description: true, price: true } },
      },
    });

    return reply.status(201).send({
      booking: {
        id: booking.id,
        status: booking.status,
        scheduledAt: booking.scheduledAt,
        durationMin: booking.durationMin,
        amount: booking.amount,
        currency: booking.currency,
        paymentMode: booking.paymentMode,
        notes: booking.notes,
        business: booking.business,
        offer: booking.offer,
      },
      // Hint for the mobile app: if PAY_AT_VENUE, no further payment step needed.
      requiresPayment: effectivePaymentMode === "RAZORPAY",
      // If business downgraded the mode, tell the app why.
      paymentModeDowngraded: effectivePaymentMode !== paymentMode,
    });
  });

  /**
   * GET /api/bookings
   * Consumer's own booking history (paginated).
   */
  app.get("/api/bookings", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const { page, limit, skip } = getPaginationParams(request.query as Record<string, string>);

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where: { userId },
        include: {
          business: { select: { id: true, name: true, address: true } },
          offer: { select: { id: true, description: true } },
        },
        orderBy: { scheduledAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: { userId } }),
    ]);

    return createPaginatedResult(items, total, page, limit);
  });

  /**
   * GET /api/bookings/:id
   * Single booking detail (must belong to the authenticated consumer).
   */
  app.get("/api/bookings/:id", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const { id } = request.params as { id: string };

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        business: { select: { id: true, name: true, address: true, phone: true, city: true } },
        offer: { select: { id: true, description: true, price: true } },
        review: { select: { id: true, rating: true, text: true } },
      },
    });

    if (!booking || booking.userId !== userId) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    return booking;
  });

  /**
   * POST /api/bookings/:id/pay
   * Initiate Razorpay payment for a booking.
   * Returns razorpayOrderId + keyId for the mobile Razorpay sheet.
   */
  app.post("/api/bookings/:id/pay", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const { id } = request.params as { id: string };

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        business: {
          select: { razorpayKeyId: true, razorpayKeySecret: true, name: true },
        },
      },
    });

    if (!booking || booking.userId !== userId) {
      return reply.status(404).send({ error: "Booking not found" });
    }
    if (booking.status !== "PENDING") {
      return reply.status(400).send({ error: `Booking is already ${booking.status}` });
    }
    if (booking.paymentMode !== "RAZORPAY") {
      return reply.status(400).send({ error: "This booking is configured for pay-at-venue" });
    }
    if (!booking.business.razorpayKeyId || !booking.business.razorpayKeySecret) {
      return reply.status(400).send({ error: "This business has not configured online payments" });
    }

    // Create a Razorpay order using the business's own credentials.
    const razorpay = new Razorpay({
      key_id: booking.business.razorpayKeyId,
      key_secret: booking.business.razorpayKeySecret,
    });

    const rzpOrder = await razorpay.orders.create({
      amount: booking.amount, // already in paise
      currency: booking.currency,
      receipt: `bk_${booking.id}`,
      notes: {
        bookingId: booking.id,
        businessName: booking.business.name,
      },
    });

    // Store the Razorpay order ID so the webhook can look up this booking.
    await prisma.booking.update({
      where: { id },
      data: { razorpayOrderId: rzpOrder.id },
    });

    return {
      razorpayOrderId: rzpOrder.id,
      keyId: booking.business.razorpayKeyId, // publishable — safe to send to client
      amount: booking.amount,
      currency: booking.currency,
    };
  });

  /**
   * POST /api/payments/razorpay-webhook
   * Razorpay calls this after a payment completes.
   * Verifies the HMAC signature then calls the booking flywheel.
   *
   * NOTE: The Razorpay webhook secret is set in the Razorpay dashboard
   * (per-business webhooks). We use the business's own key_secret to verify
   * (same key that signed the order, so no additional webhook-specific secret needed).
   *
   * Webhook body structure:
   * { event: "payment.captured", payload: { payment: { entity: { ... } } } }
   */
  app.post(
    "/api/payments/razorpay-webhook",
    { config: { rawBody: true } }, // Need raw body for HMAC verification
    async (request, reply) => {
      const signature = (request.headers["x-razorpay-signature"] as string) ?? "";
      const body = (request as any).rawBody as string;

      let event: any;
      try {
        event = JSON.parse(body);
      } catch {
        return reply.status(400).send({ error: "Invalid JSON" });
      }

      if (event.event !== "payment.captured") {
        // Other events (e.g., payment.failed) — acknowledge without action.
        return reply.status(200).send({ received: true });
      }

      const payment = event?.payload?.payment?.entity;
      const razorpayOrderId: string = payment?.order_id;
      const razorpayPaymentId: string = payment?.id;

      if (!razorpayOrderId) {
        return reply.status(400).send({ error: "Missing order_id in webhook payload" });
      }

      // Look up the booking by Razorpay order ID to get the business's key_secret for signature verification.
      const booking = await prisma.booking.findUnique({
        where: { razorpayOrderId },
        include: { business: { select: { razorpayKeySecret: true } } },
      });

      if (!booking || !booking.business.razorpayKeySecret) {
        console.warn("[razorpay-webhook] Booking not found for order:", razorpayOrderId);
        return reply.status(200).send({ received: true }); // Acknowledge to avoid retries
      }

      // Verify HMAC signature: sha256(orderId + "|" + paymentId, keySecret)
      const expectedSig = crypto
        .createHmac("sha256", booking.business.razorpayKeySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (
        !crypto.timingSafeEqual(
          Buffer.from(signature, "hex"),
          Buffer.from(expectedSig, "hex"),
        )
      ) {
        return reply.status(400).send({ error: "Invalid signature" });
      }

      // Confirm the booking (fire flywheel) — run async, return 200 immediately.
      // Razorpay retries on non-200, so we must respond fast.
      reply.status(200).send({ received: true });

      // Run flywheel after responding.
      confirmBooking(booking.id, { razorpayPaymentId }).catch((err) =>
        console.error("[razorpay-webhook] booking flywheel failed:", err),
      );
    },
  );
}
