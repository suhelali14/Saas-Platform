import type { FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";

/**
 * PHI access logging, required by India's DPDP Act 2023 and NABH: every
 * access to a patient record must be logged with the user, the timestamp
 * and what was touched, in a form that survives an audit.
 *
 * This is deliberately implemented as a single `onResponse` hook rather
 * than a `logAudit()` call sprinkled through all seventeen route modules.
 * Twice already in this project a field was silently missed at one call
 * site out of several (the `attachments` include, the schema-qualified raw
 * query), and an audit trail with a hole in it is worse than none -- it
 * reads as complete while quietly omitting whatever route someone forgot to
 * annotate. A hook cannot be forgotten by a route added next year.
 */

/** Longest-prefix-wins, so `/patients/:id/vitals-trend` doesn't get
 * classified by a shorter, earlier-matching entry. */
const RESOURCE_BY_PREFIX: Array<[string, string]> = [
  ["/api/clinic/patients", "patient"],
  ["/api/clinic/appointments", "appointment"],
  ["/api/clinic/case-sheets", "case-sheet"],
  ["/api/clinic/prescriptions", "prescription"],
  ["/api/clinic/certificates", "certificate"],
  ["/api/clinic/invoices", "invoice"],
  ["/api/clinic/billing", "billing"],
  ["/api/clinic/expenses", "expense"],
  ["/api/clinic/labs", "lab-order"],
  ["/api/clinic/lab-orders", "lab-order"],
  ["/api/clinic/reminders", "reminder"],
  ["/api/clinic/analytics", "analytics"],
  ["/api/clinic/staff", "staff"],
  ["/api/clinic/settings", "settings"],
  ["/api/clinic/profile", "profile"],
  ["/api/clinic/audit", "audit-log"],
  ["/api/clinic/export", "export"],
  ["/api/clinic/inventory", "inventory"],
  ["/api/clinic/drugs", "drug"],
];

/**
 * Routes that never touch patient data and would otherwise bury the real
 * signal. An auditor looking for who read a patient's file should not have
 * to page through a nurse's drug-autocomplete keystrokes.
 *
 * `/drugs` is a public medicine dictionary, not PHI. `/auth/me` fires on
 * every page load. The public endpoints are unauthenticated by design and
 * expose no patient data at all (verified by grep against every patient
 * name and phone in the database, each phase).
 */
function isExempt(path: string, method: string): boolean {
  if (path.startsWith("/api/clinic/public")) return true;
  if (path.startsWith("/health")) return true;
  if (path === "/api/clinic/auth/me") return true;
  // Reading the drug dictionary is noise; *adding* a drug is a real change.
  if (path.startsWith("/api/clinic/drugs") && method === "GET") return true;
  if (path.startsWith("/api/clinic/doctors") && method === "GET") return true;
  return false;
}

function resourceFor(path: string): string {
  let best = "";
  let name = "other";
  for (const [prefix, resource] of RESOURCE_BY_PREFIX) {
    if (path.startsWith(prefix) && prefix.length > best.length) {
      best = prefix;
      name = resource;
    }
  }
  return name;
}

function actionFor(method: string): string {
  switch (method) {
    case "GET":
      return "VIEW";
    case "POST":
      return "CREATE";
    case "PUT":
    case "PATCH":
      return "UPDATE";
    case "DELETE":
      return "DELETE";
    default:
      return method;
  }
}

/**
 * The PHI subject, when the request identifies one. Covers the two shapes
 * that actually carry it: `/patients/:id/...` in the path, and a
 * `patientId` in the body (how a case sheet, prescription, invoice or lab
 * order names its patient).
 *
 * A record reached only by its own id -- `/case-sheets/:id` -- resolves to
 * null rather than triggering an extra database lookup on every request.
 * The entry is still logged in full; it just isn't attributed to a patient
 * in the per-patient view. Said plainly here so nobody later reads a
 * patient's access history as exhaustive when it isn't.
 */
function patientIdFor(request: FastifyRequest): string | null {
  const path = request.url.split("?")[0] ?? "";
  const match = /^\/api\/clinic\/patients\/([^/]+)/.exec(path);
  if (match?.[1]) return match[1];

  const body = request.body;
  if (body && typeof body === "object" && "patientId" in body) {
    const value = (body as Record<string, unknown>).patientId;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

interface AuditEntry {
  clinicUserId: string | null;
  userName: string;
  userRole: string;
  action: string;
  resource: string;
  patientId: string | null;
  method: string;
  path: string;
  statusCode: number;
  ip: string | null;
}

async function write(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch {
    // An audit write must never turn a successful clinical action into a
    // failed one -- the doctor's consultation matters more than the log
    // line. This runs in `onResponse`, after the reply is already sent, so
    // there is nothing left to fail anyway.
  }
}

/** Login and failed-login attempts, recorded by name/email even when no
 * user id exists (a failed attempt has no authenticated user, and those are
 * exactly the entries a security review looks for). */
export function auditAuth(
  request: FastifyRequest,
  // SESSION_TAKEOVER is a successful sign-in that ended another device's
  // session. Recorded separately because it is the one an admin wants to
  // see: a login repeatedly taking over means two people are sharing an
  // account, which is both a seat the clinic has not paid for and an audit
  // trail that names the wrong person.
  outcome: "LOGIN" | "LOGIN_FAILED" | "SESSION_TAKEOVER",
  user: { id: string | null; name: string; role: string },
): void {
  void write({
    clinicUserId: user.id,
    userName: user.name,
    userRole: user.role,
    action: outcome,
    resource: "auth",
    patientId: null,
    method: request.method,
    path: request.url.split("?")[0] ?? request.url,
    statusCode: outcome === "LOGIN" ? 200 : 401,
    ip: request.ip ?? null,
  });
}

export function auditRequest(request: FastifyRequest, statusCode: number): void {
  const path = request.url.split("?")[0] ?? request.url;
  if (isExempt(path, request.method)) return;
  // Unauthenticated traffic to a protected route is already rejected with a
  // 401 by the route itself; there is no user to attribute it to, and
  // logging it would let anyone flood the audit table from outside.
  if (!request.clinicUserId) return;

  void write({
    clinicUserId: request.clinicUserId,
    userName: request.clinicUserName ?? "(unknown)",
    userRole: request.clinicUserRole ?? "(unknown)",
    action: actionFor(request.method),
    resource: resourceFor(path),
    patientId: patientIdFor(request),
    method: request.method,
    path,
    statusCode,
    ip: request.ip ?? null,
  });
}
