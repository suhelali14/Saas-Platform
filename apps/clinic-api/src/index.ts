import "dotenv/config";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { connectRedis } from "./lib/sessions.js";

const app = buildApp();

// Sessions live in Redis, so it is connected before the first request
// rather than by it -- see connectRedis for what went wrong otherwise.
connectRedis()
  .then((ready) => {
    if (!ready) app.log.warn("Redis did not answer within 5s; sign-in will fail until it does.");
    return app.listen({ port: env.PORT, host: "0.0.0.0" });
  })
  .then((address) => {
    app.log.info(`Clinic API listening at ${address}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
