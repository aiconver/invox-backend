// src/api/methods/form/handlers/process.ts
import { z } from "zod";
import { fillTemplate } from "../fill-template";
import { getTemplateById } from "./form-template";
import { transcribeAudio } from "../transcription";
import {
  TemplateDefinition,
  EnhancedTemplateDefinition,
  ExtractionResult,
} from "@/api/methods/types";
import { JwtUser } from "@/types/typed-request";

const schema = z.object({
  formTemplateId: z.string(),
  audio: z.string(),
});

function mapToEnhancedTemplateDefinition(template: any): EnhancedTemplateDefinition {
  return {
    templateName: template.name,
    processingType: template.processingType,
    domainKnowledge: template.domainKnowledge,
    structure: template.structure ?? {},
    context: template.context ?? undefined,
    priority: template.priority ?? undefined,
  };
}

export const processForm = async (
  params: unknown,
  user: JwtUser
): Promise<{
  transcript: string;
  extracted: ExtractionResult;
}> => {
  const { formTemplateId, audio } = schema.parse(params);

  // 🔐 Log who's processing what
  console.log(`🎙️ User ${user.preferred_username} is processing form template ${formTemplateId}`);

  const transcript = await transcribeAudio(audio);

  const template = await getTemplateById(formTemplateId);
  if (!template) throw new Error("Form template not found");

  // 🔐 Optional: restrict access to certain roles or templates
  // if (!user.realm_access?.roles.includes("admin")) {
  //   throw new Error("Access denied: only operators may process forms");
  // }

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
