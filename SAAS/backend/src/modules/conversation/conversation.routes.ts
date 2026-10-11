import { Router } from 'express';
import {
  listConversations,
  getConversation,
  sendMessage,
  updateStatus,
  assignToEmployee,
  markAsRead,
  getStats,
} from './conversation.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getStats);
router.get('/', listConversations);
router.get('/:id', getConversation);
router.post('/:id/messages', sendMessage);
router.patch('/:id/status', updateStatus);
router.patch('/:id/assign', assignToEmployee);
router.post('/:id/read', markAsRead);

export default router;
