import { z } from "zod";
import { fillTemplate } from "../fill-template";
import { getTemplateById } from "./form-template";
import { transcribeAudio } from "../transcription";
import {
  TemplateDefinition,
  EnhancedTemplateDefinition,
  ExtractionResult,
} from "@/api/methods/types";

const schema = z.object({
  formTemplateId: z.string(),
  audio: z.string(),
});

function mapToEnhancedTemplateDefinition(template: any): EnhancedTemplateDefinition {
  return {
    templateName: template.name,
    fields: template.structure?.fields ?? {},
    context: template.context ?? undefined,
    priority: template.priority ?? undefined,
  };
}

export const processForm = async (params: unknown): Promise<{
  transcript: string;
  extracted: ExtractionResult;
}> => {
  const { formTemplateId, audio } = schema.parse(params);

  const transcript = await transcribeAudio(audio);

  const template = await getTemplateById(formTemplateId);
  if (!template) throw new Error("Form template not found");

  const extracted = await fillTemplate({
    transcript,
    templateDefinition: mapToEnhancedTemplateDefinition(template),
    options: {
      confidenceThreshold: 0.7,
      maxRetries: 2,
    },
  });

  return { transcript, extracted };
};
