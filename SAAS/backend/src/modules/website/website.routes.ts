import { Router } from 'express';
import {
  getConfig,
  updateConfig,
  getPreview,
  generateAI,
  renderPublicWebsite,
  checkoutPublic,
  exportToGithub,
  getTemplateByCategory,
} from './website.controller';
import {
  listGenreProducts,
  getGenreProductByGenre,
  applyProduct,
  createGenreRequest,
  listGenreRequests,
  patchGenreRequest
} from './genre-product.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// Public website render & checkout (No auth required)
router.get('/public/:slug', renderPublicWebsite);
router.post('/public/checkout', checkoutPublic);

// Authenticated business owner config, AI generator & preview
router.get('/config', authMiddleware, getConfig);
router.post('/config', authMiddleware, updateConfig);
router.get('/preview', authMiddleware, getPreview);
router.post('/generate-ai', authMiddleware, generateAI);
router.post('/export-github', authMiddleware, exportToGithub);
router.get('/template/:category', authMiddleware, getTemplateByCategory);

// Genre Product Catalog
router.get('/genre-products', authMiddleware, listGenreProducts);
router.get('/genre-products/:genre', authMiddleware, getGenreProductByGenre);
router.post('/genre-products/:id/apply', authMiddleware, applyProduct);

// Genre Product Requests
router.post('/genre-requests', authMiddleware, createGenreRequest);
router.get('/genre-requests', authMiddleware, listGenreRequests);
router.patch('/genre-requests/:id', authMiddleware, patchGenreRequest);

export default router;
