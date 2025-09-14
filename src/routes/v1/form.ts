// src/routes/v1/form.ts (or ./formRoutes.ts)
import { Router } from "express";
import multer from "multer";
import { formController } from "@/controllers/v1/formController";

const router = Router();
const controller = new formController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB, adjust as needed
});

router.post("/transcribe", upload.single("audio"), controller.transcribe.bind(controller));
export default router;
