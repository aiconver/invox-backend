// src/api/methods/form/handlers/form.ts
import Form from "@/db/models/form";
import { z } from "zod";
import { addFormSchema, getFormSchema } from "../schemas/form";
import { JwtUser } from "@/types/typed-request";

export const addForm = async (params: unknown, user: JwtUser) => {
	const { formData } = addFormSchema.parse(params);

	// You can log or store who submitted the form
	console.log(`📝 User ${user.preferred_username} is submitting a form`);

	const form = await Form.create({
		templateId: formData.templateId,
		answers: formData.answers,
		// Optional: associate form with user if your model supports it
		// createdBy: user.sub,
	});

	return {
		message: "Form submitted successfully!",
		formId: form.id,
	};
};

export const getForm = async (params: unknown, user: JwtUser) => {
	const parsed = getFormSchema.parse(params);
	const id = parsed?.id;

	console.log(`🔍 User ${user.preferred_username} is retrieving form(s)`);

	if (id) {
		const form = await Form.findByPk(id);
		if (!form) throw new Error(`Form with ID "${id}" not found`);
		return form;
	}

	// Optional: filter by user if applicable
	// return await Form.findAll({ where: { createdBy: user.sub }, ... })

	return await Form.findAll({
		attributes: ["id", "templateId", "answers", "createdAt", "updatedAt"],
		order: [["createdAt", "DESC"]],
	});
};
