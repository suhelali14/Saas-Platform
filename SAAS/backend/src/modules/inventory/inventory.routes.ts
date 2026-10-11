import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  listInventory,
  getInventoryItem,
  adjustStock,
  getLowStockItems,
} from './inventory.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', listInventory);
router.get('/low-stock', getLowStockItems);
router.get('/:productId', getInventoryItem);
router.post('/:productId/adjust', adjustStock);

export default router;
