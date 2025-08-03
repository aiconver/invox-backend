// src/api/schemas/formTemplate.ts
import { z } from "zod";

export const getFormTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  department: z.string().optional(),
});

// Define the structure schema to validate the fields
const fieldSchema = z.object({
  type: z.enum(["textarea",
    "text",
    "date",
    "select",
    "email",
    "number",
    "radio",
    "checkbox",]), // Allowed field types
  required: z.boolean(),
});

// Define the save form template schema with JSON structure validation
export const createFormTemplateSchema = z.object({
  name: z.string().min(1),
  department: z.string().min(1),
  processingType: z.string().min(1),
  structure: z.record(z.string(), fieldSchema),
  domainKnowledge: z.string().optional(),
})

export const updateFormTemplateSchema = createFormTemplateSchema.extend({
  id: z.string().uuid(),
})

export const deleteFormTemplateSchema = z.object({
  id: z.string().uuid(),
})


export const getAssignableUsersSchema = z.object({
  formTemplateId: z.string().uuid(),
})

export const assignUsersSchema = z.object({
  formTemplateId: z.string().uuid(),
  userIds: z.array(z.string().uuid()),
})