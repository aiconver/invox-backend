import { router } from "..";
import { formRouter } from "./form";

const appRouterV1 = router({
  form: formRouter,
});

export const appRouter = router({
  api: router({
    v1: appRouterV1,
  }),
});

export type AppRouter = typeof appRouter;