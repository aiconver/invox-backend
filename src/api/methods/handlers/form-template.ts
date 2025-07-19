// src/api/handlers/formTemplate.ts
import FormTemplate from "@/db/models/formTemplate";
import { getFormTemplateSchema } from "../schemas/form-template";
import { Sequelize } from "sequelize";

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


export async function getFormTemplate(input: unknown) {
  const { id } = getFormTemplateSchema.parse(input);

  if (id) {
    const template = await FormTemplate.findByPk(id);
    if (!template) throw new Error(`FormTemplate with id "${id}" not found`);
    return template;
  }

  return await FormTemplate.findAll({
    attributes: ["id", "name", "department", "structure", "createdAt", "updatedAt"],
    order: [["createdAt", "DESC"]],
  });
}
