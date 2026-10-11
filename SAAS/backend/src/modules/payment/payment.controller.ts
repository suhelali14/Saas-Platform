import { Request, Response, NextFunction } from 'express';
import {
  getPaymentsList,
  createPaymentOrder,
  generateUpiPaymentPayload,
  generateTaxInvoiceHTML,
} from './payment.service';

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query['status'] as string | undefined;
    const data = await getPaymentsList(req.user!.businessId, status);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await createPaymentOrder(req.user!.businessId, req.body);
    res.status(201).json({ success: true, data: payment });
  } catch (e) { next(e); }
}

export async function getUpiQr(req: Request, res: Response, next: NextFunction) {
  try {
    const amount = Number(req.query['amount'] || 100);
    const orderNumber = (req.query['orderNumber'] as string) || '#1001';
    const payload = await generateUpiPaymentPayload(req.user!.businessId, amount, orderNumber);
    res.json({ success: true, data: payload });
  } catch (e) { next(e); }
}

export async function getTaxInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = req.params['orderId'] as string;
    const html = await generateTaxInvoiceHTML(req.user!.businessId, orderId);
    if (req.query['format'] === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }
    res.json({ success: true, data: { html } });
  } catch (e) { next(e); }
}
