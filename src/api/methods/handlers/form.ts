import Form from "@/db/models/form";
import User from "@/db/models/user";
import { z } from "zod";
import { addFormSchema, getFormSchema } from "../schemas/form";
import { JwtUser } from "@/types/typed-request";

export const addForm = async (params: unknown, user: JwtUser) => {
	const { formData } = addFormSchema.parse(params);

	console.log(`📝 User ${user.preferred_username} is submitting a form`);

	const existingUser = await User.findByPk(user.sub);
	if (!existingUser) {
	await User.create({
		id: user.sub,
		username: user.preferred_username,
		email: user.email,
		firstName: user.given_name ?? "Aiconver",
		lastName: user.family_name ?? "Admin",
		role: user.realm_access?.roles?.[0] ?? "operator", // choose your logic
	});
	}

	const form = await Form.create({
		templateId: formData.templateId,
		answers: formData.answers,
		createdBy: user.sub,
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
		const form = await Form.findByPk(id, {
			include: {
				model: User,
				as: "creator",
				attributes: ["id", "username", "email", "firstName", "lastName", "role"],
			},
		});
		if (!form) throw new Error(`Form with ID "${id}" not found`);
		return form;
	}

	return await Form.findAll({
		attributes: ["id", "templateId", "answers", "createdAt", "updatedAt"],
		include: {
			model: User,
			as: "creator",
			attributes: ["id", "username", "email", "firstName", "lastName", "role"],
		},
		order: [["createdAt", "DESC"]],
	});
};
