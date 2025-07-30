import { Sequelize } from "sequelize";
import FormTemplate from "@/db/models/formTemplate";
import { getFormTemplateSchema, saveFormTemplateSchema } from "../schemas/form-template";
import { ProcessingType } from "@/db/models/enums";
import { JwtUser } from "@/types/typed-request";

export async function getDepartmentsWithTemplateCount(user: JwtUser) {
  return await FormTemplate.findAll({
    attributes: [
      "department",
      [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]
    ],
    group: ["department"],
    raw: true,
  });
}

export async function getFormTemplate(input: unknown, user: JwtUser) {
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
    attributes: [
      "id", "name", "department", "processingType",
      "structure", "createdAt", "updatedAt"
    ],
    order: [["createdAt", "DESC"]],
  });
}

export async function saveFormTemplate(input: unknown, user: JwtUser) {
  const { name, department, processingType, structure } = saveFormTemplateSchema.parse(input);

  try {
    return await FormTemplate.create({
      name,
      department,
      processingType: processingType as ProcessingType,
      structure,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error saving form template:", error);
    throw new Error("Failed to save the form template");
  }
}

export async function getTemplateById(id: string) {
  return FormTemplate.findByPk(id);
}
