import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth } from "../plugins/auth.js";
import { byTriage } from "../lib/triage.js";
import { summarize } from "./clinic-billing.js";

/**
 * The one screen somebody looks at between patients.
 *
 * There was no such screen: the portal landed on the queue, which answers
 * "who is next" and nothing else. A doctor finishing a consultation had
 * no way to see that three follow-ups are due, that a lab result came
 * back, that a drug expires on Friday, or that yesterday's collections
 * are short — each of those lived on its own page, reachable only by
 * someone who already suspected it.
 *
 * ── What the research actually says ──────────────────────────────────
 *
 * The one rigorous source found is a 2026 scoping review of clinical
 * dashboards (https://www.jmir.org/2026/1/e77361), which reports that
 * only 4 of 18 implementations followed any structured guideline and 14
 * were ad hoc. The practices it does identify, and which this follows:
 *
 * - **Actionable metrics.** Every number here is something a person can
 *   act on this morning. No totals-since-inception, no vanity counts.
 *   "11 patients registered" tells nobody to do anything; "2 follow-ups
 *   overdue" does.
 * - **Layered by priority, not by category.** The order is how urgent a
 *   thing is, not which module it came from. An expired drug outranks
 *   this month's revenue even though revenue is the bigger number.
 * - **Visible data freshness.** Each payload carries when it was
 *   computed, and the UI shows it. A stale dashboard that looks live is
 *   worse than one that admits its age.
 * - **Role-based views.** Reception is handed the desk and the money;
 *   a nurse the queue; the doctor the clinical load. Nobody is shown a
 *   figure they cannot act on, and the clinic's earnings are not on a
 *   screen a locum can read.
 *
 * ── One request, not six ─────────────────────────────────────────────
 *
 * Assembled server-side on purpose. Six parallel calls from the browser
 * would each pay the round trip to a database that may be in another
 * country, and would arrive at different moments -- so the screen would
 * assemble itself in front of the reader, and two tiles could disagree
 * about what "today" means. Here they share one clock.
 */

/** Everything is "today" in the clinic's own day, not UTC. */
function dayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

const CLINICAL_ROLES = new Set(["DOCTOR", "ADMIN", "NURSE"]);
const MONEY_ROLES = new Set(["DOCTOR", "ADMIN", "RECEPTIONIST"]);
const STOCK_ROLES = new Set(["DOCTOR", "ADMIN", "PHARMACIST"]);

export async function clinicDashboardRoutes(app: FastifyInstance) {
  app.get("/api/clinic/dashboard", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const now = new Date();
    const { start, end } = dayBounds(now);
    const role = auth.role;

    // ── Today's desk ─────────────────────────────────────────────────
    //
    // Everyone sees this. It is the clinic's actual state right now and
    // there is no role for whom it is irrelevant.
    const todaysAppointments = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: start, lt: end } },
      select: {
        id: true, status: true, scheduledAt: true, vitals: true,
        doctor: { select: { id: true, name: true } },
        patient: {
          select: {
            id: true, name: true, uhid: true, category: true,
            allergies: true, chronicConditions: true,
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    const byStatus = (s: string) => todaysAppointments.filter((a) => a.status === s).length;

    /**
     * Who is actually next, by the same triage rule the queue uses.
     *
     * Imported rather than reimplemented: a dashboard that names a
     * different "next patient" than the queue screen is worse than no
     * dashboard, and two copies of a sort rule drift the first time one
     * is changed.
     */
    const waiting = todaysAppointments
      .filter((a) => a.status === "CHECKED_IN" || a.status === "SCHEDULED")
      .sort((a, b) => {
        const tier = byTriage(a, b);
        return tier !== 0 ? tier : a.scheduledAt.getTime() - b.scheduledAt.getTime();
      });

    const next = waiting[0] ?? null;
    const inProgress = todaysAppointments.find((a) => a.status === "IN_PROGRESS") ?? null;

    const today = {
      waiting: waiting.length,
      inProgress: byStatus("IN_PROGRESS"),
      completed: byStatus("COMPLETED"),
      noShow: byStatus("NO_SHOW"),
      cancelled: byStatus("CANCELLED"),
      booked: todaysAppointments.length,
      /** Vitals not yet taken for someone already waiting -- reception's
       *  job, and the thing that makes the consultation itself faster. */
      awaitingVitals: waiting.filter((a) => {
        const v = a.vitals as Record<string, unknown> | null;
        return !v || !Object.values(v).some(Boolean);
      }).length,
      // Named with their allergies, because that is the one fact a doctor
      // must not have to click to discover.
      nowServing: inProgress && {
        patientName: inProgress.patient.name,
        uhid: inProgress.patient.uhid,
        allergies: inProgress.patient.allergies,
        doctorName: inProgress.doctor?.name ?? null,
      },
      next: next && {
        patientName: next.patient.name,
        uhid: next.patient.uhid,
        category: next.patient.category,
        allergies: next.patient.allergies,
        chronicConditions: next.patient.chronicConditions,
        doctorName: next.doctor?.name ?? null,
        scheduledAt: next.scheduledAt,
      },
    };

    // ── Things that need somebody to do something ────────────────────
    const attention: { key: string; label: string; count: number; href: string; severity: "warn" | "info" }[] = [];

    if (CLINICAL_ROLES.has(role)) {
      // Follow-ups the doctor asked to be reminded about, now due.
      const dueReminders = await prisma.caseSheet.count({
        where: {
          remindDoctor: true,
          reminderResolvedAt: null,
          followUpDate: { lte: end },
          ...(role === "DOCTOR" ? { doctorId: auth.clinicUserId } : {}),
        },
      });
      if (dueReminders) {
        attention.push({
          key: "reminders", label: dueReminders === 1 ? "follow-up due" : "follow-ups due",
          count: dueReminders, href: "/reminders", severity: "warn",
        });
      }

      // A lab order with no result is a patient waiting on an answer.
      const openLabOrders = await prisma.labOrder.count({ where: { status: "ORDERED" } });
      if (openLabOrders) {
        attention.push({
          key: "labs", label: openLabOrders === 1 ? "lab order awaiting a result" : "lab orders awaiting results",
          count: openLabOrders, href: "/labs", severity: "info",
        });
      }
    }

    // Undispensed prescriptions: the pharmacy's queue, and a patient
    // standing at a counter.
    if (STOCK_ROLES.has(role) || role === "RECEPTIONIST") {
      const undispensed = await prisma.prescription.count({
        where: { dispensed: false, createdAt: { gte: start, lt: end } },
      });
      if (undispensed) {
        attention.push({
          key: "dispensing", label: undispensed === 1 ? "prescription to dispense" : "prescriptions to dispense",
          count: undispensed, href: "/pharmacy", severity: "info",
        });
      }
    }

    // ── Stock, which is the only thing here with a deadline ──────────
    let stock: { expired: number; expiringSoon: number; lowStock: number } | null = null;
    if (STOCK_ROLES.has(role)) {
      const batches = await prisma.drugBatch.findMany({
        where: { quantityInHand: { gt: 0 } },
        select: { drugId: true, expiryDate: true, quantityInHand: true, reorderThreshold: true },
      });
      const soon = new Date(now);
      soon.setDate(soon.getDate() + 30);

      const expired = batches.filter((b) => b.expiryDate < now).length;
      const expiringSoon = batches.filter((b) => b.expiryDate >= now && b.expiryDate <= soon).length;

      // Aggregated per drug, not per batch. Counting batches would call a
      // drug "low" because one of its three batches is nearly empty, and
      // would miss a drug that is genuinely out across all of them --
      // which is the bug this exact check had once before.
      const perDrug = new Map<string, { qty: number; threshold: number }>();
      for (const b of batches) {
        if (b.expiryDate < now) continue;
        const cur = perDrug.get(b.drugId) ?? { qty: 0, threshold: 0 };
        cur.qty += b.quantityInHand;
        cur.threshold = Math.max(cur.threshold, b.reorderThreshold);
        perDrug.set(b.drugId, cur);
      }
      const lowStock = [...perDrug.values()].filter((d) => d.qty <= d.threshold).length;

      stock = { expired, expiringSoon, lowStock };
      if (expired) {
        attention.push({
          key: "expired", label: expired === 1 ? "expired batch in stock" : "expired batches in stock",
          count: expired, href: "/pharmacy", severity: "warn",
        });
      }
    }

    // ── Money ────────────────────────────────────────────────────────
    //
    // Counted from payments actually received, never from invoices
    // raised. An unpaid invoice is not income, and showing it as one
    // tells the doctor the clinic earned money it has never seen.
    let money: {
      collectedToday: number;
      byMode: Record<string, number>;
      outstanding: number;
      unbilledVisits: number;
    } | null = null;

    if (MONEY_ROLES.has(role)) {
      const payments = await prisma.payment.findMany({
        where: { paidAt: { gte: start, lt: end } },
        select: { amount: true, mode: true },
      });
      const byMode: Record<string, number> = { CASH: 0, UPI: 0, CARD: 0 };
      for (const p of payments) byMode[p.mode] = (byMode[p.mode] ?? 0) + Number(p.amount);

      // Every invoice, because status is computed rather than stored --
      // there is no column to filter on, by design. The balance uses the
      // same arithmetic as the billing screen, so the two can never
      // report different dues.
      const invoices = await prisma.invoice.findMany({
        select: {
          items: { select: { amount: true, quantity: true } },
          payments: { select: { amount: true } },
        },
      });
      const outstanding = invoices.reduce((sum, inv) => sum + summarize(inv.items, inv.payments).balance, 0);

      // A completed consultation with no invoice is revenue walking out
      // of the door, and is invisible on every other screen.
      const completedToday = todaysAppointments.filter((a) => a.status === "COMPLETED");
      const invoicedPatientIds = new Set(
        (await prisma.invoice.findMany({
          where: { createdAt: { gte: start, lt: end } },
          select: { patientId: true },
        })).map((i) => i.patientId),
      );
      const unbilledVisits = completedToday.filter((a) => !invoicedPatientIds.has(a.patient.id)).length;

      money = {
        collectedToday: Object.values(byMode).reduce((a, b) => a + b, 0),
        byMode,
        outstanding,
        unbilledVisits,
      };
      if (unbilledVisits) {
        attention.push({
          key: "unbilled", label: unbilledVisits === 1 ? "completed visit not billed" : "completed visits not billed",
          count: unbilledVisits, href: "/billing", severity: "warn",
        });
      }
    }

    // Most urgent first, and within a severity the larger count. The
    // order is the point: whoever reads only the first line should be
    // reading the thing that matters most.
    attention.sort((a, b) =>
      a.severity === b.severity ? b.count - a.count : a.severity === "warn" ? -1 : 1,
    );

    return {
      // Freshness is a design responsibility, not a detail: a dashboard
      // that looks live while showing yesterday is worse than one that
      // says how old it is.
      generatedAt: now.toISOString(),
      role,
      today,
      attention,
      stock,
      money,
    };
  });
}
