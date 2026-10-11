import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  listCategories,
  createCategory,
  listServices,
  createService,
  updateService,
  deleteService,
} from './catalog.controller';

const router = Router();
router.use(authMiddleware);

// Products
router.get('/products', listProducts);
router.get('/products/:id', getProduct);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Categories
router.get('/categories', listCategories);
router.post('/categories', createCategory);

// Services
router.get('/services', listServices);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

export default router;
