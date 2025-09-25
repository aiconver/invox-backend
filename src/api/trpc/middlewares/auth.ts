import { TRPCError } from "@trpc/server";
import { middleware } from "..";
import { isEmployee } from "@/lib/auth";

export const isAuthedMiddleware = middleware((opts) => {
	const { ctx } = opts;
	if (!ctx.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return opts.next({
		ctx: {
			user: ctx.user,
		},
	});
});

export const isEmployeeMiddleware = isAuthedMiddleware.unstable_pipe((opts) => {
	if (!isEmployee(opts.ctx.user.token)) {
		throw new TRPCError({ code: "FORBIDDEN" });
	}
	return opts.next();
});
