// src/routes/v1/form.ts
import { Router } from "express";
import multer from "multer";
import { formController } from "@/controllers/v1/formController";

const router = Router();
const controller = new formController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Transcription (multipart/form-data)
router.post("/transcribe", upload.single("audio"), controller.transcribe.bind(controller));

// Template filling (JSON)
router.post("/fill", controller.fillTemplate.bind(controller));

export default router;
