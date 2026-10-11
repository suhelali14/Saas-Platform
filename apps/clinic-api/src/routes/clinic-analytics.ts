import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth } from "../plugins/auth.js";
import { resolvedSchema } from "../lib/db-schema.js";

const SCHEMA = resolvedSchema();
const DEFAULT_RANGE_DAYS = 30;

function parseRange(query: { from?: string; to?: string }): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export async function clinicAnalyticsRoutes(app: FastifyInstance) {
  // Day-wise visit trend, top diagnoses, doctor workload, new-vs-returning
  // mix -- the standard clinic analytics metric set researched for this
  // phase (visit volume trends, top-diagnoses with counts, provider
  // workload). Deliberately no financial/revenue metrics -- billing was
  // never built in this deployment.
  app.get("/api/clinic/analytics/overview", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { from, to } = parseRange(request.query as { from?: string; to?: string });

    // Day-bucketed visit counts -- Prisma's groupBy can't group by a
    // truncated timestamp expression, so this one needs raw SQL. Table name
    // schema-qualified explicitly (see lib/db-schema.ts).
    const dailyVisitsRaw = await prisma.$queryRawUnsafe<{ day: Date; count: bigint }[]>(
      `SELECT date_trunc('day', "scheduledAt") AS day, COUNT(*)::bigint AS count
       FROM "${SCHEMA}"."Appointment"
       WHERE "scheduledAt" >= $1 AND "scheduledAt" <= $2 AND status != 'CANCELLED'
       GROUP BY day ORDER BY day ASC`,
      from,
      to,
    );
    const dailyVisits = dailyVisitsRaw.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) }));

    const topDiagnosesRaw = await prisma.caseSheet.groupBy({
      by: ["diagnosis"],
      where: { diagnosis: { not: null }, createdAt: { gte: from, lte: to } },
      _count: { diagnosis: true },
      orderBy: { _count: { diagnosis: "desc" } },
      take: 10,
    });
    const topDiagnoses = topDiagnosesRaw
      .filter((r) => r.diagnosis && r.diagnosis.trim())
      .map((r) => ({ diagnosis: r.diagnosis!, count: r._count.diagnosis }));

    // Doctor workload counted from case sheets -- who actually did the
    // consultation, not just who an appointment was nominally assigned to.
    const doctorWorkloadRaw = await prisma.caseSheet.groupBy({
      by: ["doctorId"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { doctorId: true },
    });
    const doctorIds = doctorWorkloadRaw.map((r) => r.doctorId);
    const doctors = await prisma.clinicUser.findMany({ where: { id: { in: doctorIds } }, select: { id: true, name: true } });
    const doctorNameById = new Map(doctors.map((d) => [d.id, d.name]));
    const doctorWorkload = doctorWorkloadRaw
      .map((r) => ({ doctorId: r.doctorId, doctorName: doctorNameById.get(r.doctorId) ?? "Unknown", patientsSeen: r._count.doctorId }))
      .sort((a, b) => b.patientsSeen - a.patientsSeen);

    const [totalAppointments, totalCaseSheets, visitingPatients] = await Promise.all([
      prisma.appointment.count({ where: { scheduledAt: { gte: from, lte: to }, status: { not: "CANCELLED" } } }),
      prisma.caseSheet.count({ where: { createdAt: { gte: from, lte: to } } }),
      // Patients who actually had a visit in range, with their registration
      // date -- new-vs-returning has to be computed over *this same set*,
      // not "all patients registered in range" (a different denominator
      // entirely -- someone can register without ever booking, and someone
      // registered years ago can still be "returning" this month). Caught
      // live: the naive version returned 0 returning patients for a patient
      // who has visited across two separate phases of this session's testing.
      prisma.appointment.findMany({
        where: { scheduledAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
        select: { patient: { select: { id: true, createdAt: true } } },
        distinct: ["patientId"],
      }),
    ]);
    const uniquePatientsInRange = visitingPatients.length;
    const newPatients = visitingPatients.filter((v) => v.patient.createdAt >= from && v.patient.createdAt <= to).length;
    const returningPatients = uniquePatientsInRange - newPatients;

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      dailyVisits,
      topDiagnoses,
      doctorWorkload,
      totals: { totalAppointments, totalCaseSheets, uniquePatientsInRange, newPatients, returningPatients },
    };
  });

  // "Diagnosis should be very fast" -- self-learning quick-pick chips for
  // the case sheet form, from the requesting doctor's own recent usage.
  // Zero setup, no admin screen to maintain.
  app.get("/api/clinic/diagnoses/frequent", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const grouped = await prisma.caseSheet.groupBy({
      by: ["diagnosis"],
      where: { doctorId: auth.clinicUserId, diagnosis: { not: null }, createdAt: { gte: since } },
      _count: { diagnosis: true },
      orderBy: { _count: { diagnosis: "desc" } },
      take: 8,
    });
    const diagnoses = grouped.filter((r) => r.diagnosis && r.diagnosis.trim()).map((r) => r.diagnosis!);
    return { data: diagnoses };
  });
}
