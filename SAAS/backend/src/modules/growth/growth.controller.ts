import { Request, Response, NextFunction } from 'express';
import {
  getGrowthDashboard,
  launchBroadcastCampaign,
} from './growth.service';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getGrowthDashboard(req.user!.businessId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createBroadcast(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = await launchBroadcastCampaign(req.user!.businessId, req.body);
    res.status(201).json({ success: true, data: campaign });
  } catch (e) { next(e); }
}
