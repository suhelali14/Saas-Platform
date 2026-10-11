import { Request, Response, NextFunction } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer as createCustomerService,
  updateCustomer as updateCustomerService,
  deleteCustomer as deleteCustomerService,
  getCustomerSegmentStats,
  getCustomerOrderTimeline,
} from './customer.service';

export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getCustomers(req.user!.businessId, req.query);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getCustomerById(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createCustomerService(req.user!.businessId, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updateCustomerService(req.user!.businessId, req.params['id'] as string, req.body);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteCustomerService(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, message: 'Customer deactivated' });
  } catch (e) { next(e); }
}

export async function getCustomerStats(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getCustomerSegmentStats(req.user!.businessId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getCustomerTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getCustomerOrderTimeline(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
