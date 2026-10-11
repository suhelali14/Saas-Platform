import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import authPlugin from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/accounts.js";
import { healthRoutes } from "./routes/health.js";
import { env } from "./config/env.js";

export function buildApp() {
  const app = Fastify({ logger: true });

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

  app.register(authPlugin);
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(accountRoutes);

  return app;
}
