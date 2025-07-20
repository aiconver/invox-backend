import { z } from "zod";

export const fillTemplateSchema = z.object({
  transcript: z.string(),
  templateDefinition: z.object({
    templateName: z.string(),
    fields: z.record(z.any()),
  }),
});
