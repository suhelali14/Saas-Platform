import { Router } from 'express';
import { getDashboard } from './analytics.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getDashboard);

export default router;
