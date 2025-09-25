// src/lib/auth.ts
import type express from "express";
import type { JwtUser } from "../types/typed-request";
import logger from "../api/middlewares/logger";

export const getUser = async (
  req: express.Request,
  _res: express.Response,
): Promise<JwtUser | null> => {
  try {
    const decoded = (req as any).user as JwtUser | undefined;
    return decoded ?? null;
  } catch (err) {
    logger.error(`Could not read JWT user from request: ${err}`);
    return null;
  }
};

// Role helpers adapted to decoded JWT claims
export const isEmployee = (user?: JwtUser | null) =>
  !!user?.realm_access?.roles?.includes("employee");

export const isAdmin = (user?: JwtUser | null) =>
  !!user?.realm_access?.roles?.includes("admin");
