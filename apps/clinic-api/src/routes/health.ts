import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { status: "ok", service: "clinic-api", timestamp: new Date().toISOString() };
  });
}
