import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { verifyClinicToken } from "../lib/jwt.js";
import { readSession, touchSession } from "../lib/sessions.js";
import { prisma } from "../lib/prisma.js";
import { auditRequest } from "../lib/audit.js";

declare module "fastify" {
  interface FastifyRequest {
    clinicUserId: string | null;
    clinicUserRole: string | null;
    /** May administer staff, settings, audit and the website. A flag, not
     *  a role -- a clinic head who is also a doctor is both. */
    clinicUserIsAdmin: boolean;
    /** The Redis session this request arrived on. */
    clinicSessionId: string | null;
    clinicUserName: string | null;
  }
}

/**
 * The JWT carries only `{sub, role}`, but the audit trail has to record a
 * human-readable name -- "who opened this patient's file" is unanswerable
 * from a cuid. Cached because it would otherwise be a database round-trip
 * on every single authenticated request; a clinic has a handful of staff,
 * so this is a few entries that are read constantly. The TTL is short so a
 * staff member renaming themselves in Settings shows up promptly rather
 * than after a restart.
 */
const NAME_CACHE_TTL_MS = 5 * 60 * 1000;
const nameCache = new Map<string, { name: string; expiresAt: number }>();

async function resolveUserName(clinicUserId: string): Promise<string | null> {
  const cached = nameCache.get(clinicUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.name;

  try {
    const user = await prisma.clinicUser.findUnique({
      where: { id: clinicUserId },
      select: { name: true },
    });
    if (!user) return null;
    nameCache.set(clinicUserId, { name: user.name, expiresAt: Date.now() + NAME_CACHE_TTL_MS });
    return user.name;
  } catch {
    return null;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("clinicUserId", null);
  app.decorateRequest("clinicUserRole", null);
  app.decorateRequest("clinicUserName", null);
  app.decorateRequest("clinicUserIsAdmin", false);
  app.decorateRequest("clinicSessionId", null);

  app.addHook("onRequest", async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    const token = header.slice("Bearer ".length);

    try {
      const payload = verifyClinicToken(token);

      // A valid signature is not authorisation. The session must still
      // exist, which is what makes revocation possible at all.
      const session = await readSession(payload.sid);
      if (!session || session.userId !== payload.clinicUserId) return;

      // And the user must still be allowed in. Checked against the
      // database rather than trusted from the session, because the
      // question "is this person still employed here" has to be answered
      // by the record, not by a copy made when they signed in.
      const user = await prisma.clinicUser.findUnique({
        where: { id: payload.clinicUserId },
        select: { name: true, role: true, isAdmin: true, isActive: true, tokenVersion: true },
      });
      if (!user || !user.isActive) return;
      if (user.tokenVersion !== session.tokenVersion) return;

      request.clinicUserId = payload.clinicUserId;
      // From the user row, not the token: a role changed an hour ago must
      // take effect now, not when the token expires.
      request.clinicUserRole = user.role;
      request.clinicUserIsAdmin = user.isAdmin;
      request.clinicUserName = user.name;
      request.clinicSessionId = payload.sid;

      // Slide the expiry so an active shift is not signed out mid
      // consultation at exactly twelve hours.
      void touchSession(payload.sid, payload.clinicUserId);
    } catch {
      // Invalid, expired, or Redis unreachable. Left null either way, and
      // routes that require auth reject explicitly -- failing closed,
      // because serving patient data to a token whose revocation status
      // is unknown is the hole this exists to close.
    }
  });

  // Registered once, centrally: every route added from here on is audited
  // without its author having to remember anything. Runs after the reply is
  // sent, so it adds nothing to response time.
  app.addHook("onResponse", async (request, reply) => {
    auditRequest(request, reply.statusCode);
  });
};

export default fp(authPlugin);

export interface ClinicAuthContext {
  clinicUserId: string;
  role: string;
  /** May administer staff, settings, the audit log and the website.
   *  Independent of `role` -- see the ClinicUser model. */
  isAdmin: boolean;
  /** The session this request arrived on, so a route can revoke it. */
  sessionId: string | null;
}

export function requireClinicAuth(request: FastifyRequest, reply: FastifyReply): ClinicAuthContext | null {
  if (!request.clinicUserId) {
    reply.status(401).send({ error: "Authentication required" });
    return null;
  }
  return {
    clinicUserId: request.clinicUserId,
    role: request.clinicUserRole!,
    isAdmin: request.clinicUserIsAdmin === true,
    sessionId: request.clinicSessionId ?? null,
  };
}

// DOCTOR only. ADMIN used to be in here, which meant a practice
// manager given admin rights could write case sheets and
// prescriptions. Administering a clinic is not a clinical
// qualification, and the software should not imply that it is.
const CLINICAL_WRITE_ROLES = new Set(["DOCTOR"]);

/** Case sheets, prescriptions, certificates -- only a doctor (or admin) writes clinical content. */
export function requireClinicalWriteAuth(request: FastifyRequest, reply: FastifyReply): ClinicAuthContext | null {
  const auth = requireClinicAuth(request, reply);
  if (!auth) return null;
  if (!CLINICAL_WRITE_ROLES.has(auth.role)) {
    reply.status(403).send({ error: "Only a doctor can create or edit clinical records" });
    return null;
  }
  return auth;
}

/** Staff management -- doctor/admin only. */
/**
 * May administer: staff, settings, the audit log, the website.
 *
 * Reads the flag rather than the role. It used to accept DOCTOR or ADMIN,
 * so every doctor a clinic hired silently received the audit log -- which
 * records who opened which patient's file -- along with settings and
 * staff management.
 */
export function requireAdminAuth(request: FastifyRequest, reply: FastifyReply): ClinicAuthContext | null {
  const auth = requireClinicAuth(request, reply);
  if (!auth) return null;
  if (!request.clinicUserIsAdmin) {
    reply.status(403).send({ error: "Admin access required" });
    return null;
  }
  return auth;
}

// Reception included deliberately -- many small clinics (this one included)
// don't staff a dedicated nurse, and the user explicitly wants front-desk
// staff able to note BP/temp/weight etc. before the doctor's turn so the
// consultation itself moves faster. Still stops well short of clinical
// write access (diagnosis, prescriptions, certificates stay doctor/admin
// only) -- vitals are observations, not clinical judgment.
const VITALS_ROLES = new Set(["RECEPTIONIST", "NURSE", "DOCTOR", "ADMIN"]);

/** Pre-consult vitals -- reception or a nurse can record these without full
 * clinical write access. */
export function requireVitalsAuth(request: FastifyRequest, reply: FastifyReply): ClinicAuthContext | null {
  const auth = requireClinicAuth(request, reply);
  if (!auth) return null;
  if (!VITALS_ROLES.has(auth.role)) {
    reply.status(403).send({ error: "Only reception, a nurse, or a doctor can record vitals" });
    return null;
  }
  return auth;
}

const PHARMACY_ROLES = new Set(["PHARMACIST", "DOCTOR", "ADMIN"]);

/** Marking a prescription dispensed -- the compounder's own workflow, plus
 * doctor/admin oversight. Reception/nurse have no reason to touch this. */
export function requirePharmacyAuth(request: FastifyRequest, reply: FastifyReply): ClinicAuthContext | null {
  const auth = requireClinicAuth(request, reply);
  if (!auth) return null;
  if (!PHARMACY_ROLES.has(auth.role)) {
    reply.status(403).send({ error: "Only a pharmacist or doctor can update dispensing status" });
    return null;
  }
  return auth;
}

const BILLING_ROLES = new Set(["RECEPTIONIST", "DOCTOR", "ADMIN"]);

/** Invoices, payments, daily cash closing -- reception's own workflow (plus
 * doctor/admin oversight). Nurse/pharmacist have no reason to touch money. */
export function requireBillingAuth(request: FastifyRequest, reply: FastifyReply): ClinicAuthContext | null {
  const auth = requireClinicAuth(request, reply);
  if (!auth) return null;
  if (!BILLING_ROLES.has(auth.role)) {
    reply.status(403).send({ error: "Only reception, a doctor, or admin can manage billing" });
    return null;
  }
  return auth;
}

const LAB_RESULT_ROLES = new Set(["RECEPTIONIST", "NURSE", "DOCTOR", "ADMIN"]);

/** Who may see and act on appointments a stranger has requested. The list
 *  carries names, phone numbers and a stated reason for visiting, typed in
 *  by people who are not yet patients -- so it is front-desk work, not
 *  something a pharmacist or a nurse has any reason to read. */
const FRONT_DESK_ROLES = new Set(["RECEPTIONIST", "DOCTOR", "ADMIN"]);

/** Entering/uploading a lab result -- whoever actually handles the report
 * coming back from an external lab in a small clinic (often reception). */
/**
 * Who may rewrite who a patient is.
 *
 * Merging two records is irreversible and combines two people's medical
 * histories, so it is not something every signed-in user should be able
 * to do. Reception is included deliberately: they create the duplicates
 * and are usually the ones who recognise one -- often with the patient
 * standing there to confirm. A nurse or pharmacist has no business
 * deciding that two patients are one person.
 */
export function requirePatientAdminAuth(request: FastifyRequest, reply: FastifyReply): ClinicAuthContext | null {
  const auth = requireClinicAuth(request, reply);
  if (!auth) return null;
  if (!["DOCTOR", "ADMIN", "RECEPTIONIST"].includes(auth.role)) {
    reply.status(403).send({ error: "Only a doctor, admin or receptionist can merge patient records." });
    return null;
  }
  return auth;
}

export function requireLabResultAuth(request: FastifyRequest, reply: FastifyReply): ClinicAuthContext | null {
  const auth = requireClinicAuth(request, reply);
  if (!auth) return null;
  if (!LAB_RESULT_ROLES.has(auth.role)) {
    reply.status(403).send({ error: "Only reception, a nurse, or a doctor can enter lab results" });
    return null;
  }
  return auth;
}

export function requireFrontDeskAuth(request: FastifyRequest, reply: FastifyReply): ClinicAuthContext | null {
  const auth = requireClinicAuth(request, reply);
  if (!auth) return null;
  if (!FRONT_DESK_ROLES.has(auth.role)) {
    reply.status(403).send({ error: "Only reception, a doctor or an admin can handle appointment requests." });
    return null;
  }
  return auth;
}
