// src/api/methods/form/handlers/form.ts
import Form from "@/db/models/form";
import { z } from "zod";
import { addFormSchema, getFormSchema } from "../schemas/form";

export const addForm = async (params: unknown) => {
	const { formData } = addFormSchema.parse(params);

	const form = await Form.create({
		templateId: formData.templateId,
		answers: formData.answers,
	});

	return {
		message: "Form submitted successfully!",
		formId: form.id,
	};
};

export const getForm = async (params: unknown) => {
	const parsed = getFormSchema.parse(params);
	const id = parsed?.id;

	if (id) {
		const form = await Form.findByPk(id);
		if (!form) throw new Error(`Form with ID "${id}" not found`);
		return form;
	}

	return await Form.findAll({
		attributes: ["id", "templateId", "answers", "createdAt", "updatedAt"],
		order: [["createdAt", "DESC"]],
	});
};
