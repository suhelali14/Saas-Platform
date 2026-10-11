import type { FastifyInstance } from "fastify";
import { Prisma } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth } from "../plugins/auth.js";

interface VitalsPoint {
  date: string;
  bp: { systolic: number; diastolic: number } | null;
  weight: number | null;
  pulse: number | null;
  spo2: number | null;
  temp: number | null;
}

function parseVitals(date: Date, vitals: any): VitalsPoint | null {
  if (!vitals || typeof vitals !== "object") return null;
  const bpMatch = typeof vitals.bp === "string" ? vitals.bp.match(/^(\d+)\s*\/\s*(\d+)$/) : null;
  const num = (v: any) => {
    const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const point: VitalsPoint = {
    date: date.toISOString(),
    bp: bpMatch ? { systolic: Number(bpMatch[1]), diastolic: Number(bpMatch[2]) } : null,
    weight: num(vitals.weight),
    pulse: num(vitals.pulse),
    spo2: num(vitals.spo2),
    temp: num(vitals.temp),
  };
  if (!point.bp && point.weight == null && point.pulse == null && point.spo2 == null && point.temp == null) return null;
  return point;
}

export async function clinicVitalsTrendRoutes(app: FastifyInstance) {
  // Longitudinal vitals across visits -- "trends, not just isolated visit
  // notes" per the plan's research. Sourced from CaseSheet.vitals (the
  // doctor's recorded-during-consult numbers); an appointment's pre-consult
  // vitals only count if that visit never got a case sheet (e.g. the patient
  // was triaged but the consult record wasn't finished), to avoid double-
  // plotting the same visit twice.
  app.get("/api/clinic/patients/:id/vitals-trend", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) return reply.status(404).send({ error: "Not found" });

    const [caseSheets, orphanAppointments] = await Promise.all([
      prisma.caseSheet.findMany({ where: { patientId: id }, select: { createdAt: true, vitals: true }, orderBy: { createdAt: "asc" } }),
      prisma.appointment.findMany({
        where: { patientId: id, vitals: { not: Prisma.DbNull }, caseSheets: { none: {} } },
        select: { scheduledAt: true, vitals: true },
        orderBy: { scheduledAt: "asc" },
      }),
    ]);

    const points = [
      ...caseSheets.map((c) => parseVitals(c.createdAt, c.vitals)),
      ...orphanAppointments.map((a) => parseVitals(a.scheduledAt, a.vitals)),
    ]
      .filter((p): p is VitalsPoint => p !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { data: points };
  });
}
