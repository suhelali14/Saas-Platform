import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  getOrderStats,
} from './order.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', listOrders);
router.get('/stats', getOrderStats);
router.get('/:id', getOrder);
router.post('/', createOrder);
router.patch('/:id/status', updateOrderStatus);

export default router;
