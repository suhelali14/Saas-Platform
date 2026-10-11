import { Request, Response, NextFunction } from 'express';
import {
  getBusinessById,
  updateBusiness,
  updateDNA,
  markOnboardingComplete,
} from './business.service';

export async function getBusinessProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const business = await getBusinessById(req.user!.businessId);
    res.json({ success: true, data: business });
  } catch (error) {
    next(error);
  }
}

export async function updateBusinessProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const business = await updateBusiness(req.user!.businessId, req.body);
    res.json({ success: true, data: business });
  } catch (error) {
    next(error);
  }
}

export async function updateBusinessDNA(req: Request, res: Response, next: NextFunction) {
  try {
    const business = await updateDNA(req.user!.businessId, req.body);
    res.json({ success: true, data: business });
  } catch (error) {
    next(error);
  }
}

export async function completeOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const business = await markOnboardingComplete(req.user!.businessId);
    res.json({ success: true, data: business });
  } catch (error) {
    next(error);
  }
}
