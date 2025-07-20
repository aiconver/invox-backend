// src/api/methods/form/schemas/form.ts
import { z } from "zod";

export const addFormSchema = z.object({
	formData: z.object({
		templateId: z.string().uuid(),
		answers: z.record(z.any()),
	}),
});

export const getFormSchema = z
	.object({
		id: z.string().uuid().optional(),
	})
	.optional();
