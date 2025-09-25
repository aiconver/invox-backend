// src/api/trpc/context.ts
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import type { JwtUser } from "../../types/typed-request";

interface CreateInnerContextOptions extends Partial<CreateNextContextOptions> {
  user: JwtUser | null;
}

export async function createContextInner(opts: CreateInnerContextOptions) {
  return {
    user: opts.user, // no DB here anymore
  };
}

export async function createContext(opts: CreateExpressContextOptions) {
  // verifyJwt has already attached req.user (decoded JWT)
  const user = ((opts.req as any).user as JwtUser | undefined) ?? null;

  const contextInner = await createContextInner({ user });
  return {
    ...contextInner,
    req: opts.req,
    res: opts.res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
