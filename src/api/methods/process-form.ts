import { z } from "zod";
import { fillTemplate } from "./fill-template";
import { getTemplateById } from "./handlers/form-template";
import { transcribeAudio } from "./transcription";
import {
  TemplateDefinition,
  EnhancedTemplateDefinition,
  ExtractionResult,
} from "@/api/methods/fill-template/types"; // <== adjust path if needed

const schema = z.object({
  formTemplateId: z.string(),
  audio: z.string(),
});

/**
 * Maps a Sequelize FormTemplate model to a plain EnhancedTemplateDefinition.
 */
function mapToEnhancedTemplateDefinition(template: any): EnhancedTemplateDefinition {
  return {
    templateName: template.name,
    fields: template.structure?.fields ?? {},
    context: template.context ?? undefined,
    priority: template.priority ?? undefined,
  };
}

export const processForm = async (params: any): Promise<{
  transcript: string;
  extracted: ExtractionResult;
}> => {
  const { formTemplateId, audio } = schema.parse(params);

  // Step 1: Transcribe audio
  const transcript = await transcribeAudio(audio);

  // Step 2: Load form template
  const template = await getTemplateById(formTemplateId);
  if (!template) throw new Error("Form template not found");

  // Step 3: Fill form using AI
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
