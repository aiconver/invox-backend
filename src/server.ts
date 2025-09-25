// src/server.ts (or wherever startServer lives)
import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import cors from "cors";
import CombinedConfig from "./lib/config/CombinedConfig";
import { setupMiddleware } from "./middleware";
import { setupRoutes } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createContext } from "./api/trpc/context";
import { appRouter } from "./api/trpc/router";
import { verifyJwt, hasAnyRole } from "./middleware/verifyJwt"; // <-- verifyJwt too!

const config = new CombinedConfig(process.env);

export const startServer = async () => {
  try {
    const app = express();

    // Common middleware
    setupMiddleware(app);
    setupRoutes(app);

    // Protect the /trpc mount with token verification & role check
    app.use(
      "/trpc",
      verifyJwt,     // <-- decode & attach req.user
      hasAnyRole,    // <-- ensure at least one allowed role
      trpcExpress.createExpressMiddleware({
        router: appRouter,
        createContext,
        allowMethodOverride: true,
      }),
    );

    // Errors last
    app.use(notFoundHandler);
    app.use(errorHandler);

    app.listen(config.port, () => {
      console.log(`🚀 Invox backend running at http://localhost:${config.port}`);
      console.log(`📖 API docs at http://localhost:${config.port}/api/v1`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }
};
