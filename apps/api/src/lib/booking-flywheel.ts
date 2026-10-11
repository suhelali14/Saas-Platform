/**
 * Booking Flywheel — Phase A: Consumer Transaction Rail
 *
 * Called after a Booking is confirmed (either via Razorpay webhook success
 * or when a business manually accepts a pay-at-venue booking). This is the
 * bridge that converts a consumer-facing Booking into the full set of
 * BusinessOS entities:
 *   Consumer Booking → BusinessOS Customer + Appointment + Order
 *
 * All operations are wrapped in a Prisma transaction so the flywheel is
 * all-or-nothing. If it fails, the booking stays CONFIRMED but the BusinessOS
 * entities were not created — the cron retry (Phase B) will re-attempt.
 * The caller should log the error but NOT roll back the payment confirmation.
 */

import { prisma } from "./prisma.js";
import { notifyBusinessUsers } from "./push-notifications.js";

interface ConfirmBookingOptions {
  razorpayPaymentId?: string;
}

export async function confirmBooking(
  bookingId: string,
  opts: ConfirmBookingOptions = {},
): Promise<void> {
  // Fetch the booking with all relations we need.
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      business: { select: { id: true, name: true } },
      offer: { select: { id: true, description: true, price: true, serviceId: true } },
    },
  });

  // Already confirmed — idempotent call from a retried webhook, skip.
  if (booking.status === "CONFIRMED" && booking.businessOrderId) {
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // ── 1. Mark the booking confirmed ────────────────────────────────────
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "CONFIRMED",
          ...(opts.razorpayPaymentId ? { razorpayPaymentId: opts.razorpayPaymentId } : {}),
        },
      });

      // ── 2. Find or create a Customer in the business's CRM ───────────────
      // Key deduplication: phone > email > skip (anonymous guest)
      let customer = null as Awaited<ReturnType<typeof tx.customer.findFirst>>;

      if (booking.user.phone) {
        customer = await tx.customer.findFirst({
          where: { businessId: booking.businessId, phone: booking.user.phone },
        });
      } else if (booking.user.email) {
        customer = await tx.customer.findFirst({
          where: { businessId: booking.businessId, email: booking.user.email },
        });
      }

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            businessId: booking.businessId,
            name: booking.user.name ?? "Intently Customer",
            email: booking.user.email ?? undefined,
            phone: booking.user.phone ?? undefined,
            source: "INTENTLY",
            leadSource: "INTENTLY",
            notes: `Booked via Intently: ${booking.offer.description}`,
            totalOrders: 0,
            totalSpent: 0,
            segment: "NEW",
          },
        });
      }

      // ── 3. Create a BusinessOS Appointment (if linked to a Service) ───────
      let appointmentId: string | null = null;

      if (booking.offer.serviceId) {
        const service = await tx.service.findUnique({
          where: { id: booking.offer.serviceId },
          select: { id: true, duration: true },
        });

        if (service) {
          const endAt = new Date(
            booking.scheduledAt.getTime() +
              (service.duration ?? booking.durationMin) * 60 * 1000,
          );

          const appointment = await tx.appointment.create({
            data: {
              businessId: booking.businessId,
              customerId: customer.id,
              serviceId: service.id,
              status: "CONFIRMED",
              scheduledAt: booking.scheduledAt,
              duration: service.duration ?? booking.durationMin,
              endAt,
              notes: booking.notes ?? undefined,
            },
          });
          appointmentId = appointment.id;
        }
      }

      // ── 4. Create a BusinessOS Order ──────────────────────────────────────
      // Compute the next order number (outside the tx to avoid timeout risk).
      const lastOrder = await tx.order.findFirst({
        where: { businessId: booking.businessId },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      const orderNumber = String((lastOrder?.orderNumber != null ? Number(lastOrder.orderNumber) : 1000) + 1);


      const order = await tx.order.create({
        data: {
          businessId: booking.businessId,
          customerId: customer.id,
          orderNumber,
          status: "CONFIRMED",
          source: "APP", // Closest OrderSource enum value for Intently bookings
          subtotal: booking.amount,
          taxAmount: 0,
          discount: 0,
          total: booking.amount,
          currency: booking.currency,
          notes: `Intently booking #${booking.id}: ${booking.offer.description}`,
          // No OrderItems created — Intently bookings are service bookings, not
          // product orders. The full details live on the Booking record itself.
          // If a catalog Service is linked (via appointmentId), the Appointment
          // row holds the granular service reference.

        },
      });

      // ── 5. Write back flywheel IDs to the Booking ─────────────────────────
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          businessOrderId: order.id,
          appointmentId: appointmentId ?? undefined,
        },
      });

      // ── 6. Funnel event ───────────────────────────────────────────────────
      await tx.funnelEvent.create({
        data: {
          userId: booking.userId,
          eventType: "BOOKED",
          metadata: {
            bookingId,
            businessId: booking.businessId,
            amount: booking.amount,
            paymentMode: booking.paymentMode,
          },
        },
      });
    },
    { timeout: 20000 },
  );

  // ── 7. Push notification (outside tx — non-blocking) ─────────────────────
  notifyBusinessUsers(
    booking.businessId,
    "New Booking via Intently 🎉",
    `${booking.user.name ?? "A customer"} booked ${booking.offer.description} on ${new Date(booking.scheduledAt).toLocaleDateString("en-IN")}`,
    { bookingId, screen: "Bookings" },
  ).catch((err) => console.warn("[booking-flywheel] push notification failed:", err));
}
