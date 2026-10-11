import { Router } from 'express';
import {
  verifyWebhookHandler,
  handleWebhookEntry,
  sendMessageHandler,
  sendTemplateHandler,
} from './whatsapp.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// Public webhook endpoints for Meta WhatsApp Cloud API
router.get('/webhook', verifyWebhookHandler);
router.post('/webhook', handleWebhookEntry);

// Authenticated endpoints for outbound messaging
router.post('/send', authMiddleware, sendMessageHandler);
router.post('/send-template', authMiddleware, sendTemplateHandler);

export default router;
