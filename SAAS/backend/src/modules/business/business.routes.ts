import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  getBusinessProfile,
  updateBusinessProfile,
  updateBusinessDNA,
  completeOnboarding,
} from './business.controller';

const router = Router();

router.use(authMiddleware);

router.get('/profile', getBusinessProfile);
router.put('/profile', updateBusinessProfile);
router.put('/dna', updateBusinessDNA);
router.post('/onboarding/complete', completeOnboarding);

export default router;
