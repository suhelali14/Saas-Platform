import { prisma } from "./prisma.js";

// Match -> Customer flywheel hook (unify-platform Phase 4): when a
// consumer's intent matches a business, upsert a lead into that
// business's own CRM (Customer, leadSource: "INTENTLY") so the match
// shows up in BusinessOS's Customers list, not just Intently's own
// Match table.
//
// A consumer (`User`) can sign in via device-only guest auth with no
// phone or email at all -- there is no reliable key to dedupe a lead
// against in that case (Customer has no external-user-id column, only a
// `@@unique([businessId, phone])`), so guest matches with neither contact
// field are intentionally skipped rather than creating an untraceable
// duplicate customer row per match.

interface MatchedConsumer {
  name: string | null;
  phone: string | null;
  email: string | null;
}

export async function recordIntentlyLead(businessId: string, consumer: MatchedConsumer, intentSummary: string): Promise<void> {
  if (!consumer.phone && !consumer.email) return;

  const where = consumer.phone ? { businessId_phone: { businessId, phone: consumer.phone } } : undefined;

  const existing = where
    ? await prisma.customer.findUnique({ where })
    : await prisma.customer.findFirst({ where: { businessId, email: consumer.email! } });

  if (existing) {
    await prisma.customer.update({
      where: { id: existing.id },
      data: { leadSource: existing.leadSource ?? "INTENTLY", notes: existing.notes ? `${existing.notes}\n${intentSummary}` : intentSummary },
    });
    return;
  }

  await prisma.customer.create({
    data: {
      businessId,
      name: consumer.name || "Intently Lead",
      phone: consumer.phone,
      email: consumer.email,
      leadSource: "INTENTLY",
      segment: "NEW",
      notes: intentSummary,
    },
  });
}
