import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ClinicRole } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../plugins/auth.js";
import { hashPassword } from "../lib/password.js";
import { listSessions, revokeAllForUser } from "../lib/sessions.js";
import { currentPlan, maxUsers, seatUsage } from "../config/features.js";

/**
 * Who works here, and what each of them may do.
 *
 * Available on every plan. What the plan decides is how many people can
 * hold an active login at once -- see config/features.ts. Staff management
 * used to be the STANDARD+ differentiator, which left a BASIC clinic
 * sharing one password between the doctor and the front desk, and an audit
 * trail that attributed every action to the doctor.
 *
 * ── Two questions, not one ──────────────────────────────────────────
 *
 * `role` is the clinical job: it decides what someone may do to patient
 * records. `isAdmin` is whether they may administer the clinic: staff,
 * settings, the audit log, the website.
 *
 * They were one field, and it was wrong in both directions. ADMIN was
 * accepted as clinical write access, so a practice manager could write a
 * prescription. DOCTOR was hardcoded as admin-equivalent, so every doctor
 * a clinic hired received the audit log -- which records who opened which
 * patient's file -- without anyone deciding that.
 *
 * So a clinic head who is also a doctor is `DOCTOR` + admin, a
 * non-clinical practice manager is `RECEPTIONIST` + admin and still
 * cannot prescribe, and an employed doctor is `DOCTOR` and nothing else.
 */

const STAFF_SELECT = {
  id: true, email: true, name: true, role: true,
  isAdmin: true, isActive: true, createdAt: true,
} as const;

const createSchema = z.object({
  email: z.string().email(),
  // Six characters was the old floor. Ten is still modest, and this
  // account opens a patient register.
  password: z.string().min(10, "Use at least 10 characters").max(200),
  name: z.string().min(1).max(100),
  role: z.nativeEnum(ClinicRole),
  isAdmin: z.boolean().optional(),
});

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.nativeEnum(ClinicRole).optional(),
  isAdmin: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
});

/**
 * Would this change leave the clinic with nobody who can administer it?
 *
 * Recoverable only by hand-editing a production database, so it is
 * refused. The case is ordinary rather than exotic: a single-doctor
 * practice has exactly one admin, and removing their own rights or
 * deactivating themselves is two clicks away on the screen they are
 * already looking at.
 */
async function wouldOrphanClinic(targetId: string, next: { isAdmin?: boolean; isActive?: boolean }) {
  const losingAdmin = next.isAdmin === false || next.isActive === false;
  if (!losingAdmin) return false;
  const others = await prisma.clinicUser.count({
    where: { id: { not: targetId }, isAdmin: true, isActive: true },
  });
  return others === 0;
}

/** Active logins right now. Deactivated staff do not hold a seat. */
async function activeUserCount(): Promise<number> {
  return prisma.clinicUser.count({ where: { isActive: true } });
}

/**
 * Is there room for one more active login?
 *
 * Returns the message to send when there is not, so the caller cannot
 * accidentally refuse without saying why -- and the message names the
 * current plan and the next one up, because "limit reached" with no way
 * forward is a support call rather than an upgrade.
 */
async function seatCheck(): Promise<{ ok: true } | { ok: false; message: string; usage: unknown }> {
  const max = maxUsers();
  if (max === null) return { ok: true };
  const used = await activeUserCount();
  if (used < max) return { ok: true };

  const plan = currentPlan();
  const nextUp = plan.tier === "BASIC" ? "Standard" : plan.tier === "STANDARD" ? "Premium" : "Enterprise";
  return {
    ok: false,
    usage: seatUsage(used),
    message:
      `The ${plan.label} plan covers ${max} active ${max === 1 ? "login" : "logins"} and all ` +
      `${max} are in use. Deactivate someone who has left, or move to ${nextUp} for more seats.`,
  };
}

export async function clinicStaffRoutes(app: FastifyInstance) {
  app.get("/api/clinic/staff", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const staff = await prisma.clinicUser.findMany({
      select: STAFF_SELECT,
      orderBy: { createdAt: "asc" },
    });

    // How many devices each person is signed in on. An admin removing
    // somebody should be able to see that it took effect.
    const withSessions = await Promise.all(
      staff.map(async (s) => ({
        ...s,
        activeSessions: s.isActive ? (await listSessions(s.id)).length : 0,
      })),
    );
    // The cap travels with the list so the screen can show seats used
    // before somebody fills in a form they are not allowed to submit.
    return { data: withSessions, seats: seatUsage(staff.filter((s) => s.isActive).length) };
  });

  app.post("/api/clinic/staff", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.clinicUser.findUnique({ where: { email: parsed.data.email } });
    if (existing) return reply.status(409).send({ error: "A staff account with this email already exists" });

    const seats = await seatCheck();
    if (!seats.ok) {
      return reply.status(409).send({ error: seats.message, seats: seats.usage });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.clinicUser.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        name: parsed.data.name,
        role: parsed.data.role,
        isAdmin: parsed.data.isAdmin ?? false,
      },
      select: STAFF_SELECT,
    });
    return reply.status(201).send({ ...user, activeSessions: 0 });
  });

  app.patch("/api/clinic/staff/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.clinicUser.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    if (await wouldOrphanClinic(id, parsed.data)) {
      return reply.status(409).send({
        error:
          "This is the clinic's only administrator. Give someone else admin rights first, " +
          "or nobody will be able to manage staff or settings.",
      });
    }

    // Switching someone back on takes a seat, same as creating them.
    // Guarding only the create would make the cap avoidable in three
    // clicks -- deactivate one, add two, reactivate the first -- and a
    // limit people route around still refuses the honest case while
    // stopping nothing.
    if (parsed.data.isActive === true && existing.isActive === false) {
      const seats = await seatCheck();
      if (!seats.ok) {
        return reply.status(409).send({ error: seats.message, seats: seats.usage });
      }
    }

    /*
     * Does this change what the person is allowed to do?
     *
     * If so, every session they hold ends. Deactivating someone used to
     * leave their token working -- with full access to patient records --
     * until it expired up to twelve hours later, which meant the clinic
     * could not actually remove anyone. A role or admin change has the
     * same problem in miniature: access granted an hour ago should not
     * outlive the decision to take it back.
     *
     * A name change does not revoke. It is not a permission.
     */
    const permissionsChanged =
      (parsed.data.isActive !== undefined && parsed.data.isActive !== existing.isActive) ||
      (parsed.data.role !== undefined && parsed.data.role !== existing.role) ||
      (parsed.data.isAdmin !== undefined && parsed.data.isAdmin !== existing.isAdmin);

    const user = await prisma.clinicUser.update({
      where: { id },
      data: {
        ...parsed.data,
        // Bumped alongside the Redis revocation, so a session that
        // somehow survives the delete is still rejected on its next
        // request. Two independent checks rather than one, because this
        // is the mechanism that removes a person's access to patient
        // records.
        ...(permissionsChanged ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: STAFF_SELECT,
    });

    let endedSessions = 0;
    if (permissionsChanged) {
      try {
        endedSessions = await revokeAllForUser(id);
      } catch {
        // The tokenVersion bump above already invalidates them, so the
        // change still takes effect. Reported as unknown rather than
        // claimed as zero.
        endedSessions = -1;
      }
    }

    return { ...user, activeSessions: 0, endedSessions };
  });

  /**
   * Sign a staff member out of everywhere, without changing anything else.
   *
   * The case this is for: a device left logged in at a desk, or a phone
   * lost on the way home. Neither is a reason to deactivate the account
   * and stop the person working tomorrow.
   */
  app.post("/api/clinic/staff/:id/revoke-sessions", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.clinicUser.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    await prisma.clinicUser.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    const ended = await revokeAllForUser(id);
    return { ended };
  });
}
