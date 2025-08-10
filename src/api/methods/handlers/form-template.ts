import { Sequelize } from "sequelize";
import FormTemplate from "@/db/models/form-template";
import { assignUsersSchema, createFormTemplateSchema, deleteFormTemplateSchema, getAssignableUsersSchema, getFormTemplateSchema, updateFormTemplateSchema } from "../schemas/form-template";
import { ProcessingType } from "@/db/models/enums";
import { JwtUser } from "@/types/typed-request";
import User from "@/db/models/user";
import { UserFormTemplate } from "@/db/models/user-form-template";
import z from "zod";

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

export async function createFormTemplate(input: unknown, user: JwtUser) {
  const { name, department, processingType, structure, domainKnowledge } =
    createFormTemplateSchema.parse(input)

  const template = await FormTemplate.create({
    name,
    department,
    processingType: processingType as ProcessingType,
    structure,
    domainKnowledge: domainKnowledge || "",
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return { message: "Template created", templateId: template.id }
}

export async function updateFormTemplate(input: unknown, user: JwtUser) {
  const { id, name, department, processingType, structure, domainKnowledge } =
    updateFormTemplateSchema.parse(input)

  const template = await FormTemplate.findByPk(id)
  if (!template) throw new Error("Template not found")

  await template.update({
    name,
    department,
    processingType: processingType as ProcessingType,
    structure,
    domainKnowledge,
    updatedAt: new Date(),
  })

  return { message: "Template updated", templateId: id }
}

export async function deleteFormTemplate(input: unknown, user: JwtUser) {
  const { id } = deleteFormTemplateSchema.parse(input)

  const deleted = await FormTemplate.destroy({ where: { id } })
  if (!deleted) throw new Error("Template not found or already deleted")

  return { success: true }
}

export async function getTemplateById(id: string) {
  return FormTemplate.findByPk(id);
}


function hasRole(user: JwtUser, role: string): boolean {
  return user.realm_access?.roles?.includes(role) ?? false
}

export async function getAssignableUsers(input: unknown, user: JwtUser) {
  const { formTemplateId } = getAssignableUsersSchema.parse(input)

  // ❌ Only non-operators can fetch assignable users
  console.log(hasRole(user, "admin"));
  if (!hasRole(user, "admin")) {
    throw new Error("Unauthorized")
  }

  const allUsers = await User.findAll({
    attributes: ["id", "username", "email", "role"],
    where: { role: "employee" },
  })

  const assignments = await UserFormTemplate.findAll({
    where: { formTemplateId },
    attributes: ["userId"],
  })

  const assignedUserIds = new Set(assignments.map((a) => a.userId))

  const assignedUsers = allUsers.filter((u) => assignedUserIds.has(u.id))
  const unassignedUsers = allUsers.filter((u) => !assignedUserIds.has(u.id))

  return { assignedUsers, unassignedUsers }
}

export async function assignUsersToTemplate(input: unknown, user: JwtUser) {
  const { formTemplateId, userIds } = assignUsersSchema.parse(input)

  // ✅ Only allow operators to assign users
  if (!hasRole(user, "admin")) {
    throw new Error("Unauthorized")
  }

  await UserFormTemplate.destroy({ where: { formTemplateId } })

  const newAssignments = userIds.map((userId) => ({
    userId,
    formTemplateId,
  }))

  await UserFormTemplate.bulkCreate(newAssignments)

  return { success: true }
}
