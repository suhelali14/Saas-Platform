import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth, requireClinicAuth } from "../plugins/auth.js";

/**
 * Departments and service points.
 *
 * A clinical department (Orthopaedics) groups doctors and their OPD
 * queue. A service department (Cash counter, Scheme desk, Ward 2) is a
 * place where work is done; the people assigned to it see its screens.
 * What someone sees is their role plus every service point they belong
 * to, so a receptionist who also covers the scheme desk sees both.
 */

const SERVICE_POINTS = ["FRONT_DESK", "CASH_COUNTER", "INSURANCE", "SCHEMES", "PHARMACY", "LAB", "RADIOLOGY", "OT", "WARD", "RECORDS"] as const;

const deptSchema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["CLINICAL", "SERVICE"]),
  service: z.enum(SERVICE_POINTS).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export async function clinicDepartmentRoutes(app: FastifyInstance) {
  /** Every department and who is in it. Any signed-in staff member: the
   *  queue's department filter needs the list. */
  app.get("/api/clinic/departments", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const departments = await prisma.department.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: { members: { include: { user: { select: { id: true, name: true, role: true, isActive: true } } } } },
    });
    return {
      data: departments.map((d) => ({
        ...d,
        members: d.members.map((m) => m.user).filter((u) => u.isActive),
      })),
    };
  });

  /** The service points this person works at. Drives what the portal shows them. */
  app.get("/api/clinic/departments/mine", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const rows = await prisma.departmentMember.findMany({
      where: { userId: auth.clinicUserId, department: { isActive: true } },
      include: { department: { select: { id: true, name: true, kind: true, service: true } } },
    });
    return {
      departments: rows.map((r) => r.department),
      servicePoints: [...new Set(rows.map((r) => r.department.service).filter(Boolean))],
    };
  });

  app.post("/api/clinic/departments", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const parsed = deptSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    if (parsed.data.kind === "SERVICE" && !parsed.data.service) {
      return reply.status(400).send({ error: "Say what a service department does (cash counter, ward, lab...)." });
    }
    const exists = await prisma.department.findUnique({ where: { name: parsed.data.name } });
    if (exists) return reply.status(409).send({ error: `There is already a department called ${parsed.data.name}.` });
    const dept = await prisma.department.create({
      data: { ...parsed.data, service: parsed.data.kind === "SERVICE" ? parsed.data.service ?? null : null },
    });
    return reply.status(201).send(dept);
  });

  app.put("/api/clinic/departments/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = deptSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (parsed.data.name && parsed.data.name !== existing.name) {
      const clash = await prisma.department.findUnique({ where: { name: parsed.data.name } });
      if (clash) return reply.status(409).send({ error: `There is already a department called ${parsed.data.name}.` });
    }
    const dept = await prisma.department.update({ where: { id }, data: parsed.data });
    return dept;
  });

  /** Replace who works in a department. */
  app.put("/api/clinic/departments/:id/members", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({ userIds: z.array(z.string()).max(500) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const dept = await prisma.department.findUnique({ where: { id } });
    if (!dept) return reply.status(404).send({ error: "Not found" });
    const users = await prisma.clinicUser.findMany({ where: { id: { in: parsed.data.userIds } }, select: { id: true } });
    await prisma.$transaction([
      prisma.departmentMember.deleteMany({ where: { departmentId: id } }),
      prisma.departmentMember.createMany({ data: users.map((u) => ({ departmentId: id, userId: u.id })) }),
    ]);
    return { ok: true, members: users.length };
  });
}
