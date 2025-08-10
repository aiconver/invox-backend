// src/middleware/requireRole.ts
import { Request, Response, NextFunction } from 'express';
import { JwtUser } from '@/types/typed-request';

export function requireRole(...roles: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user as JwtUser;
    const userRoles = user?.realm_access?.roles ?? [];

    if (!roles.some(r => userRoles.includes(r))) {
      return res.status(403).json({ message: "Access denied: role not allowed" });
    }
    next();
  };
}
