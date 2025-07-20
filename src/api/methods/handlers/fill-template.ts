import { preprocessTranscript } from "./preprocess";
import { inferWithOpenAI } from "./infer";
import { validateAndPostProcess } from "./validate";
import { EnhancedTemplateDefinition, TemplateDefinition, ExtractionResult } from "../types";

export const fillTemplate = async ({
  transcript,
  templateDefinition,
  options = {},
}: {
  transcript: string;
  templateDefinition: TemplateDefinition | EnhancedTemplateDefinition;
  options?: {
    maxRetries?: number;
    confidenceThreshold?: number;
  };
}): Promise<ExtractionResult> => {
  if (!transcript?.trim()) throw new Error("Transcript is required");
  if (!templateDefinition?.fields || Object.keys(templateDefinition.fields).length === 0)
    throw new Error("Template fields are required");

  const enhanced: EnhancedTemplateDefinition = {
    ...templateDefinition,
    context: (templateDefinition as EnhancedTemplateDefinition).context,
    priority: (templateDefinition as EnhancedTemplateDefinition).priority,
  };

  const preprocessed = preprocessTranscript(transcript);
  const retries = options.maxRetries ?? 2;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const raw = await inferWithOpenAI(preprocessed, enhanced);
      return await validateAndPostProcess(raw, enhanced, options.confidenceThreshold ?? 0.7);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      attempt++;
    }
  }

  throw new Error("All attempts failed");
};
