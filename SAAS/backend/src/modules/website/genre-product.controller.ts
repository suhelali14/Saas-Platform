import { Request, Response, NextFunction } from 'express';
import {
  getAllGenreProducts,
  getGenreProduct,
  applyGenreProduct,
  submitGenreRequest,
  getGenreRequests,
  updateGenreRequest,
} from './genre-product.service';

/**
 * GET /api/genre-products — List all available genre products
 */
export async function listGenreProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const products = await getAllGenreProducts();
    res.json({ success: true, data: products });
  } catch (e) { next(e); }
}

/**
 * GET /api/genre-products/:genre — Get a specific genre product
 */
export async function getGenreProductByGenre(req: Request, res: Response, next: NextFunction) {
  try {
    const genre = req.params['genre'] as string;
    const product = await getGenreProduct(genre.toUpperCase());
    res.json({ success: true, data: product });
  } catch (e) { next(e); }
}

/**
 * POST /api/genre-products/:id/apply — Apply a product to the user's business
 */
export async function applyProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = req.params['id'] as string;
    const businessId = req.user!.businessId;
    const customizations = req.body.customizations || {};

    const result = await applyGenreProduct(businessId, productId, customizations);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

/**
 * POST /api/genre-requests — Submit a request for a missing genre product
 */
export async function createGenreRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user!.businessId;
    const request = await submitGenreRequest(businessId, req.body);
    res.status(201).json({ success: true, data: request });
  } catch (e) { next(e); }
}

/**
 * GET /api/genre-requests — List all genre requests (admin)
 */
export async function listGenreRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query['status'] as string | undefined;
    const requests = await getGenreRequests(status);
    res.json({ success: true, data: requests });
  } catch (e) { next(e); }
}

/**
 * PATCH /api/genre-requests/:id — Update a genre request (admin)
 */
export async function patchGenreRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const updated = await updateGenreRequest(id, req.body);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
}
