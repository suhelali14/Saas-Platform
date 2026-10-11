import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";

// Ported from SAAS/backend/src/modules/payment (unify-platform Phase 3).
// SAAS's original getPaymentsList fell back to hardcoded numbers
// (184500/142/3200/4) whenever the real aggregate was null -- which is
// every zero-transaction business, not just a display glitch. That's
// exactly the fake-data pattern this project has rejected everywhere
// else this session; replaced with real `?? 0`.

const createPaymentSchema = z.object({
  orderId: z.string(),
  amount: z.coerce.number().positive(),
  method: z.nativeEnum(PaymentMethod).optional(),
});

export async function bizPaymentRoutes(app: FastifyInstance) {
  app.get("/api/biz/payments", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { businessId: auth.businessId };
    if (query.status && query.status !== "ALL") where.status = query.status as PaymentStatus;

    const [payments, totalCollected, pendingPayments] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { orderNumber: true, total: true, customer: { select: { name: true, phone: true } } } },
        },
        take: 50,
      }),
      prisma.payment.aggregate({
        where: { businessId: auth.businessId, status: "COMPLETED" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { businessId: auth.businessId, status: "PENDING" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      payments,
      stats: {
        totalCollected: totalCollected._sum.amount ?? 0,
        totalTransactions: totalCollected._count._all,
        pendingAmount: pendingPayments._sum.amount ?? 0,
        pendingCount: pendingPayments._count._all,
      },
    };
  });

  app.post("/api/biz/payments", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = createPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const order = await prisma.order.findFirst({ where: { id: d.orderId, businessId: auth.businessId } });
    if (!order) return reply.status(404).send({ error: "Order not found" });

    const payment = await prisma.payment.create({
      data: {
        businessId: auth.businessId,
        orderId: d.orderId,
        amount: d.amount,
        currency: "INR",
        method: d.method ?? "UPI",
        status: "PENDING",
        gatewayId: `TXN_${Date.now()}`,
      },
    });

    return reply.status(201).send(payment);
  });

  app.get("/api/biz/payments/upi-qr", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const amount = Number(query.amount ?? 100);
    const orderNumber = query.orderNumber ?? "#1001";

    const business = await prisma.business.findUnique({ where: { id: auth.businessId } });
    if (!business) return reply.status(404).send({ error: "Business not found" });

    // Single placeholder collection VPA, matching SAAS's original design --
    // real per-business UPI/gateway onboarding is a payment-aggregator
    // integration, explicitly out of scope for this unification pass.
    const upiId = "businessos@icici";
    const name = encodeURIComponent(business.name);
    const note = encodeURIComponent(`Payment for Order ${orderNumber}`);
    const upiUri = `upi://pay?pa=${upiId}&pn=${name}&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;

    return { upiId, businessName: business.name, amount, orderNumber, upiUri, qrData: upiUri };
  });

  app.get("/api/biz/payments/invoice/:orderId", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { orderId } = request.params as { orderId: string };
    const query = request.query as Record<string, string | undefined>;

    const business = await prisma.business.findUnique({ where: { id: auth.businessId } });
    if (!business) return reply.status(404).send({ error: "Business not found" });

    const order = await prisma.order.findFirst({
      where: { id: orderId, businessId: auth.businessId },
      include: { items: true, customer: true },
    });
    if (!order) return reply.status(404).send({ error: "Order not found" });

    const subtotal = order.subtotal || order.total;
    const gstRate = 0.05;
    const cgst = subtotal * (gstRate / 2);
    const sgst = subtotal * (gstRate / 2);
    const grandTotal = subtotal + cgst + sgst;
    const invoiceNum = `INV-${order.orderNumber.replace("#", "")}-${new Date().getFullYear()}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Tax Invoice - ${invoiceNum}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 30px; margin: 0; background: #fff; }
    .inv-card { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px; }
    .logo-text { font-size: 24px; font-weight: 800; color: #0f172a; }
    .badge-paid { background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 12px; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .det-block h4 { margin: 0 0 6px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .det-block p { margin: 0; font-size: 14px; line-height: 1.5; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13px; }
    th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; color: #475569; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    .totals { margin-left: auto; width: 280px; }
    .tot-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
    .tot-grand { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 6px; }
    .footer { text-align: center; margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; }
    @media print { body { padding: 0; } .inv-card { border: none; box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="inv-card">
    <div class="header">
      <div>
        <div class="logo-text">${business.name}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">GSTIN: 27AABCU9603R1ZM · State: Maharashtra (27)</div>
        <div style="font-size: 12px; color: #64748b;">${business.address || "Local Marketplace"}, ${business.city || "India"} · Phone: ${business.phone || "+91 98765 43210"}</div>
      </div>
      <div style="text-align: right;">
        <span class="badge-paid">✓ TAX INVOICE</span>
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 8px;">Invoice: ${invoiceNum}</div>
        <div style="font-size: 12px; color: #64748b;">Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}</div>
      </div>
    </div>

    <div class="details">
      <div class="det-block">
        <h4>Billed To:</h4>
        <p><strong>${order.customer?.name || "Walk-in Customer"}</strong></p>
        <p>Phone: ${order.customer?.phone || "N/A"}</p>
        <p>Address: ${order.deliveryAddress || "Over the counter"}</p>
      </div>
      <div class="det-block">
        <h4>Order & Payment Info:</h4>
        <p>Order Reference: <strong>${order.orderNumber}</strong></p>
        <p>Channel: ${order.source}</p>
        <p>Payment Mode: UPI / Cash</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item Description</th>
          <th>HSN/SAC</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Rate (₹)</th>
          <th style="text-align:right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${order.items
          .map(
            (item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${item.productName}</strong></td>
            <td>1901</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">₹${item.unitPrice.toFixed(2)}</td>
            <td style="text-align:right;">₹${item.total.toFixed(2)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="tot-row">
        <span>Taxable Value:</span>
        <span>₹${subtotal.toFixed(2)}</span>
      </div>
      <div class="tot-row">
        <span>CGST (2.5%):</span>
        <span>₹${cgst.toFixed(2)}</span>
      </div>
      <div class="tot-row">
        <span>SGST (2.5%):</span>
        <span>₹${sgst.toFixed(2)}</span>
      </div>
      ${
        order.deliveryFee
          ? `
        <div class="tot-row">
          <span>Delivery Charge:</span>
          <span>₹${order.deliveryFee.toFixed(2)}</span>
        </div>
      `
          : ""
      }
      <div class="tot-row tot-grand">
        <span>Total Amount (INR):</span>
        <span>₹${grandTotal.toFixed(2)}</span>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for doing business with <strong>${business.name}</strong>!</p>
      <p>This is a computer-generated tax invoice generated by <strong>BusinessOS</strong>. No physical signature required.</p>
    </div>
  </div>
</body>
</html>`;

    if (query.format === "html") {
      reply.header("Content-Type", "text/html");
      return reply.send(html);
    }
    return { html };
  });
}
