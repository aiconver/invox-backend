import { inferProcedureBuilderResolverOptions } from "@trpc/server";
import { publicProcedure } from "..";
import { isAuthedMiddleware } from "../middlewares/auth";

// procedure that asserts that the user is logged in
export const authedProcedure = publicProcedure
	.use(isAuthedMiddleware)

export type AuthedContext = inferProcedureBuilderResolverOptions<
	typeof authedProcedure
>["ctx"];
