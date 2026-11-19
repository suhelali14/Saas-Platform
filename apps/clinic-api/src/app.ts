import Fastify from "fastify";
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
import { clinicTranslationRoutes } from "./routes/clinic-translations.js";
import { clinicDocTemplateRoutes } from "./routes/clinic-doc-template.js";
import { isFeatureEnabled } from "./config/features.js";
import { env } from "./config/env.js";
import { clinicDepartmentRoutes } from "./routes/clinic-departments.js";
import { clinicCounterRoutes } from "./routes/clinic-counter.js";
import { clinicIpdRoutes } from "./routes/clinic-ipd.js";
import { clinicClaimRoutes } from "./routes/clinic-claims.js";
import { clinicOtRoutes, clinicRadiologyRoutes, clinicNursingRoutes } from "./routes/clinic-wards.js";

export function buildApp() {
  const app = Fastify({ logger: true });

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

    const aborted =
      error.code === "ERR_STREAM_PREMATURE_CLOSE" ||
      error.message === "Premature close" ||
      request.raw.destroyed;

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
    allowList: (request) => request.url === "/health",
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
  if (env.CLINIC_READ_ONLY) {
    const ALLOWED_WRITES = new Set(["/api/clinic/auth/login", "/api/clinic/auth/logout"]);
    app.addHook("onRequest", async (request, reply) => {
      const method = request.method.toUpperCase();
      if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
      const path = request.url.split("?")[0] ?? "";
      if (ALLOWED_WRITES.has(path)) return;
      // The public website is the patients', not the clinic's staff: a
      // booking request or feedback goes through, and a patient is never
      // shown a message about the clinic's account with Nayaversse.
      if (path.startsWith("/api/clinic/public/")) return;
      return reply.status(423).send({
        error: "This clinic's account is paused, so nothing can be changed right now. Everything can still be viewed and exported. Please contact Nayaversse.",
        readOnly: true,
      });
    });
  }

  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }); // matches lib/file-storage.ts's cap
  app.register(authPlugin);
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
  app.register(clinicDocTemplateRoutes);

  // Plan-gated modules. A module that is off is never registered, so its
  // paths 404 like any other and there is nothing to probe -- see
  // config/features.ts.
  if (isFeatureEnabled("staff")) app.register(clinicStaffRoutes);
  if (isFeatureEnabled("billing")) app.register(clinicBillingRoutes);
  if (isFeatureEnabled("labs")) app.register(clinicLabRoutes);
  if (isFeatureEnabled("pharmacy")) app.register(clinicInventoryRoutes);
  if (isFeatureEnabled("analytics")) app.register(clinicAnalyticsRoutes);
  if (isFeatureEnabled("expenses")) app.register(clinicExpenseRoutes);
  if (isFeatureEnabled("multilingual")) app.register(clinicTranslationRoutes);
  // Hospital modules.
  if (isFeatureEnabled("departments")) app.register(clinicDepartmentRoutes);
  if (isFeatureEnabled("cashcounter")) app.register(clinicCounterRoutes);
  if (isFeatureEnabled("ipd")) app.register(clinicIpdRoutes);
  if (isFeatureEnabled("insurance") || isFeatureEnabled("schemes")) app.register(clinicClaimRoutes);
  if (isFeatureEnabled("ot")) app.register(clinicOtRoutes);
  if (isFeatureEnabled("radiology")) app.register(clinicRadiologyRoutes);
  // The ward list and chart need inpatients; writing on the chart is the
  // nursing module, checked in the route.
  if (isFeatureEnabled("nursing") && isFeatureEnabled("ipd")) app.register(clinicNursingRoutes);

  return app;
}
