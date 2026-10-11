import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth } from "../plugins/auth.js";

// Doctor follow-up reminders -- explicitly in-app only. No SMS/email/push
// infrastructure exists in this deployment (same reasoning as the rest of
// this project's honestly-scoped feature list), so this is a list the
// relevant staff see while using the portal, polled from the frontend --
// not a phone notification. A case sheet only shows up here if the doctor
// opted in via `remindDoctor` when setting the follow-up date.
const LOOKAHEAD_DAYS = 7;

export async function clinicReminderRoutes(app: FastifyInstance) {
  app.get("/api/clinic/reminders", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const now = new Date();
    const lookahead = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

    // A doctor sees their own follow-ups by default; everyone else (reception
    // routinely calls patients to book the follow-up, admin oversees all)
    // sees the full clinic list unless they narrow it with ?doctorId=.
    const { doctorId } = request.query as { doctorId?: string };
    const scopedDoctorId = doctorId || (auth.role === "DOCTOR" ? auth.clinicUserId : undefined);

    const reminders = await prisma.caseSheet.findMany({
      where: {
        remindDoctor: true,
        reminderResolvedAt: null,
        followUpDate: { lte: lookahead },
        doctorId: scopedDoctorId,
      },
      include: {
        patient: { select: { id: true, uhid: true, name: true, phone: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: { followUpDate: "asc" },
      take: 100,
    });

    const due = reminders.filter((r) => r.followUpDate && r.followUpDate <= now);
    const upcoming = reminders.filter((r) => r.followUpDate && r.followUpDate > now);

    return { data: reminders, due: due.length, upcoming: upcoming.length };
  });
}
