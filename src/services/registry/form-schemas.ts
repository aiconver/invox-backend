import { z } from "zod";
import type { FormTemplateField } from "./form-types";

export function zodFieldValueSchema(field: FormTemplateField): z.ZodTypeAny {
  switch (field.type) {
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
    case "number":
      return z.number().finite().nullable();
    case "enum":
      if (field.options?.length) {
        return z.enum(field.options as [string, ...string[]]).nullable();
      }
      return z.string().nullable();
    case "text":
    case "textarea":
    default:
      if (field.pattern) {
        try {
          const re = new RegExp(field.pattern);
          return z.string().regex(re).nullable();
        } catch {
          return z.string().nullable();
        }
      }
      return z.string().nullable();
  }
}

export function buildResultSchema(fields: FormTemplateField[]) {
  const entries = Object.fromEntries(
    fields.map((f) => [
      f.id,
      z.object({
        value: zodFieldValueSchema(f),
        confidence: z.number().min(0).max(1).optional(),
        evidence: z
          .object({
            transcriptSnippet: z.string().min(1).max(280).optional(),
          })
          .optional(),
      }),
    ])
  );
  return z.object(entries);
}
