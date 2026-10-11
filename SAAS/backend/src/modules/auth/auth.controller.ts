import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, refreshUserToken, getCurrentUser } from './auth.service';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await loginUser(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const tokens = await refreshUserToken(refreshToken);
    res.json({ success: true, data: { tokens } });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getCurrentUser(req.user!.userId);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}
