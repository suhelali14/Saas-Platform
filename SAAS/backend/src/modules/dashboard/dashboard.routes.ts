import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getOverview } from './dashboard.controller';

const router = Router();

router.use(authMiddleware);
router.get('/overview', getOverview);

export default router;
