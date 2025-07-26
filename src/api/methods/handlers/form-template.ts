import FormTemplate from "@/db/models/formTemplate";
import { getFormTemplateSchema, saveFormTemplateSchema } from "../schemas/form-template";
import { Sequelize } from "sequelize";
import { ProcessingType } from "@/db/models/enums";

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
		attributes: ["id", "name", "department", "processingType", "structure", "createdAt", "updatedAt"],
		order: [["createdAt", "DESC"]],
	});
}


export async function saveFormTemplate(input: unknown) {
  const { name, department, processingType, structure } = saveFormTemplateSchema.parse(input);

  try {
    // Create and save the new form template
    const newTemplate = await FormTemplate.create({
      name,
      department,
      processingType: processingType as ProcessingType,
      structure,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Returning the saved template (you can customize this response as needed)
    return newTemplate;
  } catch (error) {
    console.error("Error saving form template:", error);
    throw new Error("Failed to save the form template");
  }
}

/**
 * Get a single form template by its ID.
 */
export async function getTemplateById(id: string) {
  return FormTemplate.findByPk(id);
}
