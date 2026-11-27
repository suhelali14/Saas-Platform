import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { clinicAuthRoutes } from "./routes/clinic-auth.js";
import { clinicPatientRoutes } from "./routes/clinic-patients.js";
import { clinicSpecialtyRoutes } from "./routes/clinic-specialty.js";
import { clinicAppointmentRoutes } from "./routes/clinic-appointments.js";
import { clinicCaseSheetRoutes } from "./routes/clinic-case-sheets.js";
import { clinicDrugRoutes } from "./routes/clinic-drugs.js";
import { clinicPrescriptionRoutes } from "./routes/clinic-prescriptions.js";
import { clinicCertificateRoutes } from "./routes/clinic-certificates.js";
import { clinicCertificateTemplateRoutes } from "./routes/clinic-certificate-templates.js";
import { clinicServiceItemRoutes } from "./routes/clinic-service-items.js";
import { clinicStaffRoutes } from "./routes/clinic-staff.js";
import { clinicReminderRoutes } from "./routes/clinic-reminders.js";
import { clinicAnalyticsRoutes } from "./routes/clinic-analytics.js";
import { clinicDashboardRoutes } from "./routes/clinic-dashboard.js";
import { clinicBillingRoutes } from "./routes/clinic-billing.js";
import { clinicInventoryRoutes } from "./routes/clinic-inventory.js";
import { clinicVitalsTrendRoutes } from "./routes/clinic-vitals-trend.js";
import { clinicLabRoutes } from "./routes/clinic-labs.js";
import { clinicPublicRoutes } from "./routes/clinic-public.js";
import { clinicSettingsRoutes } from "./routes/clinic-settings.js";
import { clinicAuditRoutes } from "./routes/clinic-audit.js";
import { clinicExpenseRoutes } from "./routes/clinic-expenses.js";
import { clinicExportRoutes } from "./routes/clinic-export.js";
import { clinicSiteRoutes } from "./routes/clinic-site.js";
import { clinicBookingRoutes } from "./routes/clinic-booking.js";
import { clinicConnectorRoutes } from "./routes/clinic-connector.js";
import { clinicGrowthRoutes } from "./routes/clinic-growth.js";
import { clinicTranslationRoutes } from "./routes/clinic-translations.js";
import { clinicDocTemplateRoutes } from "./routes/clinic-doc-template.js";
import { isFeatureEnabled, isReadOnly, type Feature } from "./config/features.js";
import { clinicPlanRoutes } from "./routes/clinic-plan.js";
import { env } from "./config/env.js";
import { clinicDepartmentRoutes } from "./routes/clinic-departments.js";
import { clinicCounterRoutes } from "./routes/clinic-counter.js";
import { clinicIpdRoutes } from "./routes/clinic-ipd.js";
import { clinicClaimRoutes } from "./routes/clinic-claims.js";
import { clinicOtRoutes, clinicRadiologyRoutes, clinicNursingRoutes } from "./routes/clinic-wards.js";
import { clinicScribeRoutes } from "./routes/clinic-scribe.js";
import { clinicAssistantRoutes } from "./routes/clinic-assistant.js";
import { collectDeclared } from "./lib/assistant/declare.js";
import { INTERNAL_CALL_HEADER, INTERNAL_CALL_TOKEN } from "./lib/assistant/seal.js";

export function buildApp() {
  /*
   * In production every request arrives through nginx on the same
   * machine, so without this the address Fastify sees for EVERYBODY is
   * the proxy's. Two things were quietly wrong because of it:
   *
   *   - Rate limits are counted per address. With one address for the
   *     whole world, the login limit of five a minute was shared by every
   *     user of the clinic and every stranger on the internet: anybody
   *     could keep a clinic's staff locked out of signing in with five
   *     wrong guesses a minute.
   *   - The audit log records the address of each access. It recorded the
   *     proxy's, every time.
   *
   * Exactly ONE hop is trusted -- the nginx in front of this server --
   * and no more: nginx appends the address it actually saw to
   * X-Forwarded-For, and that last entry is the only one a client cannot
   * write for itself. Trusting by address range instead would let a
   * client on a private network (a clinic's LAN, a VPN) put any address
   * it liked in the header and be believed. The container's port is
   * bound to 127.0.0.1 (deploy/render-compose.sh), so nothing but that
   * nginx can reach this server at all.
   */
  const app = Fastify({ logger: true, trustProxy: env.NODE_ENV === "production" ? (_address: string, hop: number) => hop < 1 : false });

  /**
   * A client that navigates away, or aborts a request it no longer needs,
   * closes the socket mid-response. Fastify surfaces that as a 500-level
   * error, which is wrong: nothing failed, the reader simply left.
   *
   * This matters because the live document preview aborts its in-flight
   * render on every keystroke and slider move by design. Left alone, a
   * doctor adjusting their letterhead would fill the clinic's logs with
   * false alarms and bury real errors.
   */
  app.setErrorHandler((error: Error & { code?: string; statusCode?: number }, request, reply) => {
    // Anything can be thrown in JavaScript, and a plugin throwing a plain
    // object used to land here with no message and no status.
    if (!(error instanceof Error)) {
      const thrown = error as unknown as Record<string, unknown>;
      error = Object.assign(new Error(String(thrown?.error ?? thrown?.message ?? "Request failed")), {
        statusCode: typeof thrown?.statusCode === "number" ? thrown.statusCode : undefined,
      });
    }

    // The SOCKET, not the request stream. A request stream is also
    // "destroyed" once its body has been read to the end, which is every
    // upload: so any error thrown after reading a file was taken for a
    // client that had left, nothing was sent back, and the browser waited
    // on a request that would never answer.
    const aborted =
      error.code === "ERR_STREAM_PREMATURE_CLOSE" ||
      error.message === "Premature close" ||
      request.socket.destroyed;

    if (aborted) {
      request.log.debug({ url: request.url }, "client aborted the request");
      return;
    }

    // A plugin may already have decided the status -- the rate limiter sets
    // 429 on the reply before throwing. Reading it off the error alone
    // turned every throttled login into a 500, which tells the caller
    // nothing and looks like the server broke.
    const status = error.statusCode ?? (reply.statusCode >= 400 ? reply.statusCode : 500);

    // 4xx is the caller's problem and its message is actionable ("Too many
    // requests"). 5xx is ours and may leak internals, so only those are
    // made generic.
    if (status >= 500) {
      request.log.error({ err: error, url: request.url }, "request failed");
    } else {
      request.log.warn({ err: error.message, url: request.url, status }, "request rejected");
    }

    if (!reply.sent) {
      reply.status(status).send({
        error: status >= 500 ? "Something went wrong." : error.message,
      });
    }
  });

  // CORS is an allowlist in production.
  //
  // `origin: true` reflects whatever Origin the browser sent, which means
  // any website a staff member happens to have open could drive their
  // logged-in session against this API. For a system holding patient
  // records that is not an acceptable default.
  //
  // Development stays permissive so the Vite dev server on any port works.
  const allowed = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o: string) => o.trim())
    .filter(Boolean);

  app.register(cors, {
    credentials: true,
    origin:
      env.NODE_ENV !== "production"
        ? true
        : (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
            // A same-origin or server-to-server request sends no Origin.
            if (!origin) return cb(null, true);
            if (allowed.includes(origin)) return cb(null, true);
            cb(new Error("Origin not allowed"), false);
          },
  });
  /**
   * Rate limiting, strictest on the login route.
   *
   * An unthrottled login on a system holding patient records is
   * brute-forceable, and the audit log would faithfully record all ten
   * thousand attempts while doing nothing to stop them.
   *
   * Keyed by IP. A clinic behind one NAT shares an address, so the global
   * ceiling is generous; the login limit is what actually matters and five
   * failures a minute is far beyond honest mistyping.
   */
  app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    // Health checks are polled by the provider console on a timer and
    // must never be throttled into looking like an outage.
    // And a call this server makes of itself (the assistant carrying out
    // a change through the app's own route) was counted when it came in.
    allowList: (request) => request.url === "/health" || request.headers[INTERNAL_CALL_HEADER] === INTERNAL_CALL_TOKEN,
    // Must be a real Error carrying statusCode. fastify-rate-limit throws
    // whatever this returns, and a plain object arrives at the error
    // handler with no status and no message -- which is how a throttled
    // login came back as a generic 500.
    errorResponseBuilder: (_request, context) => {
      const retryIn = Math.ceil((context.ttl ?? 60_000) / 1000);
      const error = new Error(`Too many attempts. Try again in ${retryIn} seconds.`) as Error & { statusCode: number };
      error.statusCode = 429;
      return error;
    },
  });

  /*
   * A suspended clinic is read-only, not locked out.
   *
   * Anything can be looked at, printed or exported; nothing can be
   * changed. Signing in and out still work, or nobody could reach the
   * records to read them. Patient data is never hidden or deleted for
   * non-payment: the clinic still has patients, and a doctor who cannot
   * see an allergy because an invoice is late is a safety problem, not a
   * billing lever.
   */
  // Checked on every request, not once at start: the Nayaversse console can
  // pause a clinic, or lift the pause, over a signed call (routes/clinic-plan.ts).
  {
    const ALLOWED_WRITES = new Set(["/api/clinic/auth/login", "/api/clinic/auth/logout"]);
    app.addHook("onRequest", async (request, reply) => {
      if (!isReadOnly()) return;
      const method = request.method.toUpperCase();
      if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
      const path = request.url.split("?")[0] ?? "";
      if (ALLOWED_WRITES.has(path)) return;
      // The public website is the patients', not the clinic's staff: a
      // booking request or feedback goes through, and a patient is never
      // shown a message about the clinic's account with Nayaversse.
      if (path.startsWith("/api/clinic/public/")) return;
      // Patients asking through the clinic's WhatsApp assistant are the same
      // patients as the website's: their request still reaches reception.
      if (path === "/api/connector/v1/requests" || path === "/api/connector/v1/callback") return;
      // Asking the assistant is a POST, and looking something up through
      // it changes nothing. A change it is asked to make goes through the
      // app's own route, which this same hook refuses.
      if (path === "/api/clinic/assistant/ask" || path === "/api/clinic/assistant/voice") return;
      // The way out of a pause: paying for the plan, and the console
      // setting it, must still go through.
      if (path.startsWith("/api/clinic/plan/") || path.startsWith("/api/s2s/v1/")) return;
      return reply.status(423).send({
        error: "This clinic's account is paused, so nothing can be changed right now. Everything can still be viewed and exported. Please contact Nayaversse.",
        readOnly: true,
      });
    });
  }

  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }); // matches lib/file-storage.ts's cap
  app.register(authPlugin);
  // Before any route: each one is looked at as it is registered, and one
  // that says the assistant may use it becomes something the assistant
  // can be asked for (lib/assistant/declare.ts).
  collectDeclared(app);
  app.register(healthRoutes);
  app.register(clinicAuthRoutes);
  app.register(clinicPatientRoutes);
  // Specialty records are clinical records, so every plan has them.
  app.register(clinicSpecialtyRoutes);
  app.register(clinicAppointmentRoutes);
  app.register(clinicCaseSheetRoutes);
  app.register(clinicDrugRoutes);
  app.register(clinicPrescriptionRoutes);
  app.register(clinicCertificateRoutes);
  app.register(clinicCertificateTemplateRoutes);
  app.register(clinicServiceItemRoutes);
  app.register(clinicReminderRoutes);
  app.register(clinicDashboardRoutes);
  app.register(clinicVitalsTrendRoutes);
  app.register(clinicPublicRoutes);
  app.register(clinicSettingsRoutes);
  // Never gated: a legal duty and the way out. See config/features.ts.
  app.register(clinicAuditRoutes);
  app.register(clinicExportRoutes);
  app.register(clinicSiteRoutes);
  app.register(clinicBookingRoutes);
  app.register(clinicConnectorRoutes);
  app.register(clinicGrowthRoutes);
  app.register(clinicPlanRoutes);
  app.register(clinicDocTemplateRoutes);

  // Plan-gated modules. Every one is registered, and each request is checked
  // against the plan in force now, so a plan the console changes applies at
  // once. A module that is off answers exactly as an unknown path does, so
  // there is still nothing to probe -- see config/features.ts.
  const gated = (on: () => boolean, routes: (app: FastifyInstance) => Promise<void> | void) =>
    async (scope: FastifyInstance) => {
      scope.addHook("onRequest", async (_request, reply) => {
        if (!on()) return reply.callNotFound();
      });
      await scope.register(routes);
    };
  const has = (f: Feature) => () => isFeatureEnabled(f);
  app.register(gated(has("staff"), clinicStaffRoutes));
  app.register(gated(has("billing"), clinicBillingRoutes));
  app.register(gated(has("labs"), clinicLabRoutes));
  app.register(gated(has("pharmacy"), clinicInventoryRoutes));
  app.register(gated(has("analytics"), clinicAnalyticsRoutes));
  app.register(gated(has("expenses"), clinicExpenseRoutes));
  app.register(gated(has("multilingual"), clinicTranslationRoutes));
  app.register(gated(has("scribe"), clinicScribeRoutes));
  app.register(gated(has("scribe"), clinicAssistantRoutes));
  // Hospital modules.
  app.register(gated(has("departments"), clinicDepartmentRoutes));
  app.register(gated(has("cashcounter"), clinicCounterRoutes));
  app.register(gated(has("ipd"), clinicIpdRoutes));
  app.register(gated(() => isFeatureEnabled("insurance") || isFeatureEnabled("schemes"), clinicClaimRoutes));
  app.register(gated(has("ot"), clinicOtRoutes));
  app.register(gated(has("radiology"), clinicRadiologyRoutes));
  // The ward list and chart need inpatients; writing on the chart is the
  // nursing module, checked in the route.
  app.register(gated(() => isFeatureEnabled("nursing") && isFeatureEnabled("ipd"), clinicNursingRoutes));

  return app;
}
