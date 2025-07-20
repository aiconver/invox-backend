// src/api/methods/form.ts
import { z } from "zod";
import Form from "@/db/models/form";

export const add = async (params: unknown) => {
	const schema = z.object({
		formData: z.object({
			templateId: z.string().uuid(),
			answers: z.record(z.any()),
		}),
	});

	const { formData } = schema.parse(params);

	const form = await Form.create({
		templateId: formData.templateId,
		answers: formData.answers,
	});

	return {
		message: "Form submitted successfully!",
		formId: form.id,
	};
};

// ✅ New GET endpoint
export const get = async (params: unknown) => {
	const schema = z
		.object({
			id: z.string().uuid().optional(),
		})
		.optional();

	const parsed = schema.parse(params);
	const id = parsed?.id;

	if (id) {
		const form = await Form.findByPk(id);
		if (!form) throw new Error(`Form with ID "${id}" not found`);
		return form;
	}

	// return all forms
	return await Form.findAll({
		attributes: ["id", "templateId", "answers", "createdAt", "updatedAt"],
		order: [["createdAt", "DESC"]],
	});
};
