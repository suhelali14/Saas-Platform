import { Request, Response, NextFunction } from 'express';
import {
  getEmployees,
  getEmployeeById,
  createEmployee as createEmployeeService,
  updateEmployee as updateEmployeeService,
  deleteEmployee as deleteEmployeeService,
} from './employee.service';

export async function listEmployees(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getEmployees(req.user!.businessId, req.query);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getEmployeeById(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createEmployeeService(req.user!.businessId, req.body);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updateEmployeeService(req.user!.businessId, req.params['id'] as string, req.body);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function deleteEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteEmployeeService(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, message: 'Employee deactivated' });
  } catch (e) { next(e); }
}
