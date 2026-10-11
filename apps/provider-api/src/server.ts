import "dotenv/config";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { startHealthPolling } from "./lib/health.js";

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
});
