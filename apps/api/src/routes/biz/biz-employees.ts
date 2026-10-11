import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";

// Ported from SAAS/backend/src/modules/employee (unify-platform Phase 3).

const createEmployeeSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  workingHours: z.record(z.unknown()).optional(),
  isAvailable: z.boolean().optional(),
});

const updateEmployeeSchema = createEmployeeSchema.partial();

export async function bizEmployeeRoutes(app: FastifyInstance) {
  app.get("/api/biz/employees", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = { businessId: auth.businessId, isActive: true };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { role: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({ where, orderBy: { name: "asc" }, skip, take }),
      prisma.employee.count({ where }),
    ]);

    return createPaginatedResult(employees, total, page, limit);
  });

  app.get("/api/biz/employees/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const employee = await prisma.employee.findFirst({
      where: { id, businessId: auth.businessId },
      include: {
        appointments: {
          where: { scheduledAt: { gte: new Date() } },
          orderBy: { scheduledAt: "asc" },
          take: 5,
          include: {
            customer: { select: { name: true, phone: true } },
            service: { select: { name: true, duration: true, price: true } },
          },
        },
      },
    });
    if (!employee) return reply.status(404).send({ error: "Not found" });
    return employee;
  });

  app.post("/api/biz/employees", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = createEmployeeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const employee = await prisma.employee.create({
      data: {
        businessId: auth.businessId,
        name: d.name,
        phone: d.phone,
        email: d.email,
        role: d.role,
        department: d.department,
        workingHours: d.workingHours as Prisma.InputJsonValue | undefined,
        isAvailable: d.isAvailable !== false,
      },
    });
    return reply.status(201).send(employee);
  });

  app.put("/api/biz/employees/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.employee.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const parsed = updateEmployeeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    return prisma.employee.update({
      where: { id },
      data: {
        name: d.name,
        phone: d.phone,
        email: d.email,
        role: d.role,
        department: d.department,
        workingHours: d.workingHours as Prisma.InputJsonValue | undefined,
        isAvailable: d.isAvailable,
      },
    });
  });

  app.delete("/api/biz/employees/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.employee.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    await prisma.employee.update({ where: { id }, data: { isActive: false } });
    return { message: "Employee deactivated" };
  });
}
