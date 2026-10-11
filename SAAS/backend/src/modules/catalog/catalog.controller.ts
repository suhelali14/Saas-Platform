import { Request, Response, NextFunction } from 'express';
import {
  getProducts,
  getProductById,
  createProduct as createProductService,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
  getCategories,
  createCategory as createCategoryService,
  getServices,
  createService as createServiceService,
  updateService as updateServiceService,
  deleteService as deleteServiceService,
} from './catalog.service';

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getProducts(req.user!.businessId, req.query);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getProductById(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createProductService(req.user!.businessId, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updateProductService(req.user!.businessId, req.params['id'] as string, req.body);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteProductService(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, message: 'Product deactivated' });
  } catch (e) { next(e); }
}

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getCategories(req.user!.businessId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createCategoryService(req.user!.businessId, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function listServices(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getServices(req.user!.businessId, req.query);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function createService(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createServiceService(req.user!.businessId, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateService(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updateServiceService(req.user!.businessId, req.params['id'] as string, req.body);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteService(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteServiceService(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, message: 'Service deactivated' });
  } catch (e) { next(e); }
}
