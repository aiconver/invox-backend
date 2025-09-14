// src/routes/v1/index.ts
import { Router } from "express";
import healthRoutes from "./health";
import formRoutes from "./form";
// Import other route modules here as they're created
// import userRoutes from "./users";
// import productRoutes from "./products";

const router = Router();

// API v1 documentation endpoint
router.get("/", (req, res) => {
  res.json({
    version: "1.0.0",
    description: "Invox API v1",
    endpoints: {
      health: "/api/v1/health",
      form: "/api/v1/form",
      // users: "/api/v1/users",
      // products: "/api/v1/products"
    },
    documentation: "https://docs.invox.com/api/v1",
  });
});

// Mount route modules
router.use("/health", healthRoutes);
router.use("/form", formRoutes);

export default router;
