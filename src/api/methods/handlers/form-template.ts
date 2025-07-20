import FormTemplate from "@/db/models/formTemplate";
import { getFormTemplateSchema } from "../schemas/form-template";
import { Sequelize } from "sequelize";

/**
 * Get a list of departments with how many templates each has.
 */
export async function getDepartmentsWithTemplateCount() {
  const result = await FormTemplate.findAll({
    attributes: [
      "department",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]
    ],
    group: ["department"],
    raw: true,
  });

  return result;
}

/**
 * Get one or more form templates, filtered by ID or department.
 */
export async function getFormTemplate(input: unknown) {
	const { id, department } = getFormTemplateSchema.parse(input);

	if (id) {
		const template = await FormTemplate.findByPk(id);
		if (!template) throw new Error(`FormTemplate with id "${id}" not found`);
		return template;
	}

	const where: any = {};
	if (department) {
		where.department = department;
	}

	return await FormTemplate.findAll({
		where,
		attributes: ["id", "name", "department", "structure", "createdAt", "updatedAt"],
		order: [["createdAt", "DESC"]],
	});
}

/**
 * Get a single form template by its ID.
 */
export async function getTemplateById(id: string) {
  return FormTemplate.findByPk(id);
}
