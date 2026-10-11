import { Router } from 'express';
import {
  getDashboard,
  createBroadcast,
} from './growth.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getDashboard);
router.post('/broadcast', createBroadcast);

export default router;
