/**
 * Who is asking the assistant, what is on their screen, and how its
 * actions reach the rest of the app.
 *
 * Shared by the two places the assistant acts from: the bar on every
 * screen (routes/clinic-assistant.ts) and the end of a consultation it
 * listened to (routes/clinic-scribe.ts).
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../prisma.js";
import type { Call, RunContext } from "./actions.js";
import type { Reply } from "./registry.js";
import { INTERNAL_CALL_HEADER, INTERNAL_CALL_TOKEN, seal } from "./seal.js";

/**
 * The app's own routes, called as the person who is asking.
 *
 * Every change the assistant makes goes through here, so the role check,
 * the validation and the audit entry are the ones the screen's own Save
 * button gets. There is no second set of permission rules to keep in
 * step with the first.
 */
export function callAs(app: FastifyInstance, request: FastifyRequest): Call {
  return async (method, url, payload) => {
    const res = await app.inject({
      method,
      url,
      headers: {
        authorization: request.headers.authorization ?? "",
        [INTERNAL_CALL_HEADER]: INTERNAL_CALL_TOKEN,
        ...(payload === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
    });
    let body: unknown = null;
    try { body = res.json(); } catch { /* not JSON: a PDF, or nothing */ }
    return { status: res.statusCode, body };
  };
}

export async function contextFor(app: FastifyInstance, request: FastifyRequest, on: { patientId?: string; appointmentId?: string }): Promise<RunContext> {
  let patientId: string | null = null;
  let appointmentId: string | null = null;
  // What the browser says is on screen is looked up, not taken on trust:
  // an id that names nothing is simply no patient.
  if (on.appointmentId) {
    const visit = await prisma.appointment.findUnique({ where: { id: on.appointmentId }, select: { id: true, patientId: true } });
    if (visit) { appointmentId = visit.id; patientId = visit.patientId; }
  } else if (on.patientId) {
    const patient = await prisma.patient.findUnique({ where: { id: on.patientId }, select: { id: true } });
    if (patient) patientId = patient.id;
  }
  if (patientId) request.auditPatientId = patientId;
  return {
    asker: { userId: request.clinicUserId!, role: request.clinicUserRole!, isAdmin: request.clinicUserIsAdmin === true, name: request.clinicUserName ?? "" },
    patientId,
    appointmentId,
    today: new Date(),
    call: callAs(app, request),
  };
}

/**
 * A change is sent out sealed to the patient it was drawn up for, and to
 * the person it was drawn up for (seal.ts). Anything else passes through.
 */
export function sealed(reply: Reply, context: RunContext): Reply {
  if (reply.kind !== "confirm") return reply;
  const card = { action: reply.action, params: reply.params, patientId: context.patientId, appointmentId: context.appointmentId, userId: context.asker.userId };
  return { ...reply, patientId: context.patientId, appointmentId: context.appointmentId, seal: seal(card) } as Reply;
}
