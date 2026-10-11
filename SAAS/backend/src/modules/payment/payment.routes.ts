import { Router } from 'express';
import {
  listPayments,
  createPayment,
  getUpiQr,
  getTaxInvoice,
} from './payment.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', listPayments);
router.post('/', createPayment);
router.get('/upi-qr', getUpiQr);
router.get('/invoice/:orderId', getTaxInvoice);

export default router;
