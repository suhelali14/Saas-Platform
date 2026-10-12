import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireAdminAuth } from "../plugins/auth.js";
import { saveUploadedFile, readStoredFile, mimeFromPath, FileValidationError } from "../lib/file-storage.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { getSetupStatus } from "../lib/setup-status.js";

// Clinic settings + per-doctor profile (Phase 5). Before this, the clinic's
// address/phone/registration number/consultation fee could only be set by
// re-running the seed script, and `logoPath`/`signatureImagePath` were
// declared in the schema but never written or read -- prescriptions went
// out with a printed underscore line instead of a real signature.

const timingSchema = z.object({
  day: z.string().min(1).max(20),
  opensAt: z.string().max(10).optional(),
  closesAt: z.string().max(10).optional(),
  closed: z.boolean().optional(),
});

const clinicSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  registrationNumber: z.string().max(100).optional(),
  defaultConsultationFee: z.coerce.number().min(0).max(1_000_000).optional(),
  about: z.string().max(2000).optional(),
  timings: z.array(timingSchema).max(7).optional(),
  services: z.array(z.string().min(1).max(100)).max(30).optional(),
  tagline: z.string().max(200).optional(),
  establishedYear: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  highlights: z.array(z.object({ title: z.string().min(1).max(100), description: z.string().max(300).optional() })).max(8).optional(),
  faqs: z.array(z.object({ question: z.string().min(1).max(200), answer: z.string().min(1).max(1000) })).max(12).optional(),
  emergencyPhone: z.string().max(30).optional(),
  mapUrl: z.string().max(500).optional(),
});

const profileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  qualifications: z.string().max(200).optional(),
  specialization: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  showOnPublicPage: z.boolean().optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional().nullable(),
  languages: z.string().max(200).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(200),
});

export async function clinicSettingsRoutes(app: FastifyInstance) {
  app.get("/api/clinic/settings", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const clinic = await prisma.clinic.findFirst();
    if (!clinic) return reply.status(404).send({ error: "Clinic not configured" });
    return clinic;
  });

  /**
   * What is still missing from this clinic's public page.
   *
   * Readable by any signed-in staff member, not just an admin: reception
   * is who fields "I could not find your timings online", and being able
   * to see why is more useful than being told it is not their screen.
   * Nothing here is patient data, and nothing here is a secret.
   */
  app.get("/api/clinic/setup-status", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const status = await getSetupStatus();
    if (!status) return reply.status(404).send({ error: "Clinic not configured" });
    return status;
  });

  // Clinic-wide branding/config -- doctor or admin only. Reception editing
  // the registration number that prints on legal certificates would be the
  // wrong boundary.
  app.put("/api/clinic/settings", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = clinicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.clinic.findFirst();
    if (!existing) return reply.status(404).send({ error: "Clinic not configured" });

    const { email, ...rest } = parsed.data;
    const clinic = await prisma.clinic.update({
      where: { id: existing.id },
      data: { ...rest, email: email === "" ? null : email },
    });
    return clinic;
  });

  app.post("/api/clinic/settings/logo", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const existing = await prisma.clinic.findFirst();
    if (!existing) return reply.status(404).send({ error: "Clinic not configured" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    try {
      const saved = await saveUploadedFile("branding", existing.id, data.filename, data.mimetype, data.file);
      const clinic = await prisma.clinic.update({ where: { id: existing.id }, data: { logoPath: saved.storagePath } });
      return clinic;
    } catch (err) {
      if (err instanceof FileValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  // ── Per-doctor profile ────────────────────────────────────────────────
  app.get("/api/clinic/profile", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const user = await prisma.clinicUser.findUnique({
      where: { id: auth.clinicUserId },
      select: { id: true, name: true, email: true, role: true, qualifications: true, specialization: true, bio: true, photoPath: true, signatureImagePath: true, showOnPublicPage: true, experienceYears: true, languages: true },
    });
    if (!user) return reply.status(404).send({ error: "Not found" });
    return user;
  });

  // Anyone can edit their *own* profile -- this is their name and bio, not
  // a privilege boundary.
  app.put("/api/clinic/profile", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const user = await prisma.clinicUser.update({
      where: { id: auth.clinicUserId },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, qualifications: true, specialization: true, bio: true, photoPath: true, signatureImagePath: true, showOnPublicPage: true, experienceYears: true, languages: true },
    });
    return user;
  });

  app.post("/api/clinic/profile/signature", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    try {
      const saved = await saveUploadedFile("branding", auth.clinicUserId, data.filename, data.mimetype, data.file);
      const user = await prisma.clinicUser.update({
        where: { id: auth.clinicUserId },
        data: { signatureImagePath: saved.storagePath },
        select: { id: true, signatureImagePath: true },
      });
      return user;
    } catch (err) {
      if (err instanceof FileValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  app.post("/api/clinic/profile/photo", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    try {
      const saved = await saveUploadedFile("branding", auth.clinicUserId, data.filename, data.mimetype, data.file);
      const user = await prisma.clinicUser.update({
        where: { id: auth.clinicUserId },
        data: { photoPath: saved.storagePath },
        select: { id: true, photoPath: true },
      });
      return user;
    } catch (err) {
      if (err instanceof FileValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  // Staff can finally rotate their own credentials -- previously impossible
  // without a DB write. Requires the current password, so a walked-away
  // unlocked session can't silently lock the real owner out.
  app.post("/api/clinic/profile/password", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const parsed = passwordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const user = await prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId } });
    if (!user) return reply.status(404).send({ error: "Not found" });

    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!valid) return reply.status(400).send({ error: "Current password is incorrect" });

    await prisma.clinicUser.update({
      where: { id: auth.clinicUserId },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });
    return { ok: true };
  });

  // Branding images are the one upload class that is genuinely public --
  // a logo and a doctor's photo appear on the public clinic page, which has
  // no login. Patient documents stay behind auth, as before.
  // Path shape is `<scope>/<entityId>/<file>` -- exactly the storagePath
  // written by saveUploadedFile, so the frontend can serve an image with
  // `${apiBase}/public/${storagePath}` and nothing has to re-derive it.
  // `scope` is checked, not trusted: only branding is ever public.
  app.get("/api/clinic/public/:scope/:id/:file", async (request, reply) => {
    const { scope, id, file } = request.params as { scope: string; id: string; file: string };
    if (scope !== "branding") return reply.status(404).send({ error: "Not found" });

    const storagePath = `${scope}/${id}/${file}`;
    const stream = readStoredFile(storagePath);
    if (!stream) return reply.status(404).send({ error: "Not found" });

    reply.header("Content-Type", mimeFromPath(storagePath));
    reply.header("Cache-Control", "public, max-age=300");
    return reply.send(stream);
  });
}
