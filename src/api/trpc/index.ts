import { initTRPC } from "@trpc/server";
import { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const maxDuration = 300; // seconds

export const middleware = t.middleware;
export const router = t.router;
export const publicProcedure = t.procedure;
