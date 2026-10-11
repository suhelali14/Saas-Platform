import { Request, Response, NextFunction } from 'express';
import { getAnalyticsDashboard } from './analytics.service';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const range = (req.query['range'] as string) || '30d';
    const data = await getAnalyticsDashboard(req.user!.businessId, range);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
