import type { FastifyInstance } from "fastify";
import { redisHealthy } from "../lib/sessions.js";

export async function healthRoutes(app: FastifyInstance) {
  /**
   * Is this clinic actually able to work?
   *
   * Redis is included because nobody can sign in without it -- a session
   * is what a token points at, so an unreachable Redis means the clinic
   * is locked out even though the process is up and answering. A health
   * check that reports "ok" in that state tells the deploy to keep going
   * and tells monitoring there is nothing wrong.
   *
   * Still 200 when Redis is down, deliberately. The container is serving,
   * already-signed-in staff can keep working, and the deploy's rollback
   * is for a process that cannot serve at all. The degradation is
   * reported in the body for whoever is reading it.
   */
  app.get("/health", async () => {
    const sessions = await redisHealthy();
    return {
      status: sessions ? "ok" : "degraded",
      service: "clinic-api",
      checks: { sessions: sessions ? "ok" : "unreachable" },
      timestamp: new Date().toISOString(),
    };
  });
}
