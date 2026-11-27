import { prisma } from "./prisma.js";
import { sign } from "./connector.js";

/**
 * Tells the clinic's WhatsApp assistant that reception confirmed or
 * declined a request it sent, so the patient hears back on WhatsApp.
 *
 * Fire and forget: reception's confirmation has already been saved, and a
 * WhatsApp message that does not go out must never undo it or keep the
 * desk waiting. Signed with the token's hash (lib/connector.ts), so
 * Growth knows the message is the clinic's.
 */
export function notifyConnector(requestId: string): void {
  void (async () => {
    const req = await prisma.appointmentRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true, source: true, status: true, phone: true, connectorTokenId: true, note: true,
        appointment: { select: { scheduledAt: true, doctor: { select: { name: true } } } },
      },
    });
    if (!req || req.source !== "whatsapp" || !req.connectorTokenId || req.status === "NEW") return;
    const token = await prisma.connectorToken.findUnique({ where: { id: req.connectorTokenId } });
    if (!token || token.revokedAt || !token.callbackUrl) return;
    const body = JSON.stringify({
      type: req.status === "CONFIRMED" ? "request.confirmed" : "request.declined",
      requestId: req.id,
      phone: req.phone,
      start: req.appointment?.scheduledAt.toISOString() ?? null,
      doctor: req.appointment?.doctor?.name ?? null,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      await fetch(token.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Connector-Signature": sign(token.tokenHash, body) },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  })().catch(() => {
    /* the patient is told by phone instead; the clinic's record is complete */
  });
}
