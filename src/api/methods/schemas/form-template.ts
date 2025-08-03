// src/api/schemas/formTemplate.ts
import { z } from "zod";

export const getFormTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  department: z.string().optional(),
});

// Define the structure schema to validate the fields
const fieldSchema = z.object({
  type: z.enum(["textarea", "text", "date", "select"]), // Allowed field types
  required: z.boolean(),
});

// Define the save form template schema with JSON structure validation
export const saveFormTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  department: z.string().min(1, "Department is required"),
  processingType: z.string().min(1, "Processing type is required"),
  structure: z.record(z.string(), fieldSchema), // Allow dynamic keys and ensure each field is validated
});

export const getAssignableUsersSchema = z.object({
  formTemplateId: z.string().uuid(),
})

export const assignUsersSchema = z.object({
  formTemplateId: z.string().uuid(),
  userIds: z.array(z.string().uuid()),
})