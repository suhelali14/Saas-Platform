import { Request, Response, NextFunction } from 'express';
import { getInventory, getInventoryByProduct, adjustInventoryStock, getLowStock } from './inventory.service';
import { MovementType } from '@prisma/client';

export async function listInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getInventory(req.user!.businessId, req.query);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getInventoryItem(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getInventoryByProduct(req.user!.businessId, req.params['productId'] as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function adjustStock(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adjustInventoryStock(req.user!.businessId, req.params['productId'] as string, {
      type: req.body.type as MovementType,
      quantity: parseInt(req.body.quantity),
      reason: req.body.reason,
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getLowStockItems(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getLowStock(req.user!.businessId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
