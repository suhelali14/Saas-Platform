import "dotenv/config";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { startHealthPolling } from "./lib/health.js";
import { pushesMayWait, renewTestSubscriptions, retryPushes } from "./lib/subscriptions.js";

const app = buildApp();

// 0.0.0.0 in production: a container or PaaS routes traffic to the
// published port from outside the host, and 127.0.0.1 silently refuses it.
// Loopback is kept in development so a dev server is not exposed on the
// local network.
const host = env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";

app.listen({ port: env.PORT, host }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Provider console API listening at ${address}`);
  startHealthPolling();
  // Paid cycles a product has not heard about are retried; in test mode
  // the console renews test subscriptions as Razorpay would. The database
  // is Neon, which sleeps when idle and bills the minutes it is awake: the
  // loop reads it only while a push waits, and otherwise every six hours.
  if (env.SUBSCRIPTIONS_MODE !== "off") {
    const SWEEP_MS = 6 * 60 * 60 * 1000;
    let sweptAt = 0;
    setInterval(() => {
      const sweep = Date.now() - sweptAt >= SWEEP_MS;
      if (sweep) sweptAt = Date.now();
      if (sweep || pushesMayWait()) retryPushes().catch((e) => app.log.warn({ err: e }, "subscription pushes"));
      if (sweep && env.SUBSCRIPTIONS_MODE === "test") renewTestSubscriptions().catch((e) => app.log.warn({ err: e }, "test renewals"));
    }, 60_000).unref();
  }
});
