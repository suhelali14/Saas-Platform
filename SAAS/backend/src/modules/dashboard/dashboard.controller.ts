import { Request, Response, NextFunction } from 'express';
import { getDashboardOverview } from './dashboard.service';

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const overview = await getDashboardOverview(req.user!.businessId);
    res.json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
}
