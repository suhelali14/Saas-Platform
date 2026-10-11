import { Router } from 'express';
import { chatWithAI, testIntentClassifier } from './ai.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/chat', chatWithAI);
router.post('/classify', testIntentClassifier);

export default router;
