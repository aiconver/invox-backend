import Form from "@/db/models/form";
import User from "@/db/models/user";
import { z } from "zod";
import { addFormSchema, getFormSchema, updateFormStatusSchema } from "../schemas/form";
import { JwtUser } from "@/types/typed-request";
import { FormStatusEnums } from "@/db/models/enums";
import FormTemplate from "@/db/models/form-template";

export const addForm = async (params: unknown, user: JwtUser) => {
	const { formData } = addFormSchema.parse(params);

	console.log(`📝 User ${user.preferred_username} is submitting a form`);

	const existingUser = await User.findOne({ where: { email: user.email } });
	if (!existingUser) {
	throw new Error(`User with email ${user.email} not found in database`);
	}

	const form = await Form.create({
		templateId: formData.templateId,
		answers: formData.answers,
		createdBy: existingUser.id,
		status: FormStatusEnums.Submitted,
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

  const include = [
    {
      model: User,
      as: "creator",
      attributes: ["id", "username", "email", "firstName", "lastName", "role"],
    },
    {
      model: FormTemplate,
      as: "template",
      attributes: ["id", "name", "department"],
    },
  ];

  if (id) {
    const form = await Form.findByPk(id, { include });
    if (!form) throw new Error(`Form with ID "${id}" not found`);
    return form;
  }

  return await Form.findAll({
    attributes: ["id", "templateId", "answers", "createdAt", "updatedAt", "status"],
    include,
    order: [["createdAt", "DESC"]],
  });
};


export const updateForm = async (params: unknown, user: JwtUser) => {
  const { formId, status } = updateFormStatusSchema.parse(params);

  console.log(`🛠️ User ${user.preferred_username} is updating form ${formId} to status "${status}"`);

  const form = await Form.findByPk(formId);
  if (!form) {
    throw new Error(`Form with ID "${formId}" not found`);
  }

  form.status = status;
  await form.save();

  return {
    message: `Form status updated to "${status}"`,
    formId: form.id,
  };
};
