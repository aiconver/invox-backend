// src/api/methods/form/schemas/form.ts
import { FormStatusEnums } from "@/db/models/enums";
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


export const updateFormStatusSchema = z.object({
	formId: z.string().uuid(),
	status: z.enum([
	FormStatusEnums.Approved,
	FormStatusEnums.Rejected,
	FormStatusEnums.Submitted,
	]),
});