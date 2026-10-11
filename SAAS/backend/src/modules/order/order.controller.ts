import { Request, Response, NextFunction } from 'express';
import {
  getOrders,
  getOrderById,
  createOrder as createOrderService,
  updateStatus,
  getOrderStats as getOrderStatsService,
} from './order.service';
import { OrderStatus } from '@prisma/client';

export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getOrders(req.user!.businessId, req.query);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getOrderById(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createOrderService(req.user!.businessId, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updateStatus(req.user!.businessId, req.params['id'] as string, req.body.status as OrderStatus);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getOrderStats(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getOrderStatsService(req.user!.businessId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
