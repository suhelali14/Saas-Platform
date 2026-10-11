import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats,
  getCustomerTimeline,
} from './customer.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', listCustomers);
router.get('/stats', getCustomerStats);
router.get('/:id', getCustomer);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);
router.get('/:id/timeline', getCustomerTimeline);

export default router;
