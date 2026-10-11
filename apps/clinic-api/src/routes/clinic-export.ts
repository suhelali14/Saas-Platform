import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../plugins/auth.js";

/**
 * Data export.
 *
 * Two separate reasons this exists, and they are not the same thing:
 *
 * 1. **The clinic owns its data.** This is a single-tenant product the
 *    doctor pays for. If they ever stop paying, or the vendor disappears,
 *    their patient records must not be trapped in a database only we can
 *    read. A product holding a decade of someone's medical records with no
 *    export is holding them hostage.
 * 2. **DPDP Act 2023 data-principal rights.** A patient can ask for the
 *    personal data held about them. `GET /patients/:id/report/pdf` (Phase
 *    3) already answers that in human-readable form; this adds the
 *    machine-readable equivalent.
 *
 * Admin-gated, and audited like everything else -- a full-database export
 * is the single most sensitive action in this system, so the log entry
 * matters more here than anywhere.
 *
 * CSV is offered alongside JSON because the realistic destination is the
 * doctor's accountant or a spreadsheet, not another API.
 */

/** RFC 4180: wrap in quotes, double any interior quote. Without this a
 * patient address containing a comma silently shifts every later column. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(csvCell).join(",");
  const body = rows.map((row) => columns.map((c) => csvCell(row[c])).join(",")).join("\r\n");
  return rows.length > 0 ? `${header}\r\n${body}` : header;
}

export async function clinicExportRoutes(app: FastifyInstance) {
  /** Everything, as JSON. The disaster-recovery / data-portability answer. */
  app.get("/api/clinic/export/full", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const [clinic, patients, appointments, caseSheets, prescriptions, certificates, invoices, labOrders, expenses] =
      await Promise.all([
        prisma.clinic.findFirst(),
        prisma.patient.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.appointment.findMany({ orderBy: { scheduledAt: "asc" } }),
        prisma.caseSheet.findMany({ include: { attachments: true }, orderBy: { createdAt: "asc" } }),
        prisma.prescription.findMany({ include: { items: true }, orderBy: { createdAt: "asc" } }),
        prisma.certificate.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.invoice.findMany({ include: { items: true, payments: true }, orderBy: { createdAt: "asc" } }),
        prisma.labOrder.findMany({ include: { items: true }, orderBy: { createdAt: "asc" } }),
        prisma.expense.findMany({ orderBy: { paidAt: "asc" } }),
      ]);

    // Staff are included without password hashes. An export is a file that
    // gets emailed, copied to a USB stick and left on a desktop -- putting
    // credential material in it would turn a backup into a breach.
    const staff = await prisma.clinicUser.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const filename = `clinic-export-${new Date().toISOString().slice(0, 10)}.json`;
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);

    return {
      exportedAt: new Date().toISOString(),
      exportedBy: { id: auth.clinicUserId, role: auth.role },
      note: "Attachment and lab-report files are stored on disk under uploads/ and are NOT included in this JSON. Back that directory up alongside this file.",
      clinic,
      staff,
      patients,
      appointments,
      caseSheets,
      prescriptions,
      certificates,
      invoices,
      labOrders,
      expenses,
    };
  });

  /** One table as CSV, for the accountant or a spreadsheet. */
  app.get("/api/clinic/export/csv/:table", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { table } = request.params as { table: string };

    let rows: Record<string, unknown>[];
    let columns: string[];

    switch (table) {
      case "patients": {
        const patients = await prisma.patient.findMany({ orderBy: { createdAt: "asc" } });
        columns = ["uhid", "name", "gender", "dob", "age", "phone", "address", "bloodGroup", "allergies", "chronicConditions", "category", "createdAt"];
        // Mapped explicitly rather than cast from the model. A cast to
        // Record<string, unknown> makes every column name an unchecked
        // string: the first version of this listed "dateOfBirth", which is
        // not a field on Patient (it's `dob`), so every exported patient
        // had a silently blank date of birth and no age at all. Building
        // the row by hand puts those names back under the compiler.
        rows = patients.map((p) => ({
          uhid: p.uhid,
          name: p.name,
          gender: p.gender,
          dob: p.dob,
          age: p.age,
          phone: p.phone,
          address: p.address,
          bloodGroup: p.bloodGroup,
          allergies: p.allergies,
          chronicConditions: p.chronicConditions,
          category: p.category,
          createdAt: p.createdAt,
        }));
        break;
      }
      case "appointments": {
        const appts = await prisma.appointment.findMany({
          include: { patient: { select: { uhid: true, name: true } }, doctor: { select: { name: true } } },
          orderBy: { scheduledAt: "asc" },
        });
        columns = ["uhid", "patientName", "doctorName", "scheduledAt", "status", "reason"];
        rows = appts.map((a) => ({
          uhid: a.patient.uhid,
          patientName: a.patient.name,
          doctorName: a.doctor?.name ?? "",
          scheduledAt: a.scheduledAt,
          status: a.status,
          reason: a.reason,
        }));
        break;
      }
      case "invoices": {
        const invoices = await prisma.invoice.findMany({
          include: { patient: { select: { uhid: true, name: true } }, items: true, payments: true },
          orderBy: { createdAt: "asc" },
        });
        columns = ["uhid", "patientName", "createdAt", "billed", "paid", "outstanding"];
        rows = invoices.map((inv) => {
          const billed = inv.items.reduce((s, i) => s + Number(i.amount) * i.quantity, 0);
          const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
          return {
            uhid: inv.patient.uhid,
            patientName: inv.patient.name,
            createdAt: inv.createdAt,
            billed,
            paid,
            outstanding: Math.max(0, billed - paid),
          };
        });
        break;
      }
      case "expenses": {
        const expenses = await prisma.expense.findMany({
          include: { recordedBy: { select: { name: true } } },
          orderBy: { paidAt: "asc" },
        });
        columns = ["paidAt", "category", "description", "amount", "paymentMode", "vendor", "recordedBy", "notes"];
        rows = expenses.map((e) => ({
          paidAt: e.paidAt,
          category: e.category,
          description: e.description,
          amount: Number(e.amount),
          paymentMode: e.paymentMode,
          vendor: e.vendor ?? "",
          recordedBy: e.recordedBy.name,
          notes: e.notes ?? "",
        }));
        break;
      }
      case "audit": {
        const entries = await prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: 10_000 });
        columns = ["at", "userName", "userRole", "action", "resource", "patientId", "method", "path", "statusCode", "ip"];
        rows = entries.map((e) => ({
          at: e.at,
          userName: e.userName,
          userRole: e.userRole,
          action: e.action,
          resource: e.resource,
          patientId: e.patientId,
          method: e.method,
          path: e.path,
          statusCode: e.statusCode,
          ip: e.ip,
        }));
        break;
      }
      default:
        return reply.status(404).send({ error: "Unknown table. Use: patients, appointments, invoices, expenses, audit" });
    }

    const filename = `${table}-${new Date().toISOString().slice(0, 10)}.csv`;
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    // Excel opens a UTF-8 CSV as mojibake without a BOM, and Indian patient
    // names routinely contain non-ASCII characters.
    return reply.send(`﻿${toCsv(rows, columns)}`);
  });
}
