// src/api/schemas/formTemplate.ts
import { z } from "zod";

export const getFormTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  department: z.string().optional(),
});
