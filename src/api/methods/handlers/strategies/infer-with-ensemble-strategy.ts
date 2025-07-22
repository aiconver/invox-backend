import { EnhancedTemplateDefinition } from "../../types";
import { inferWithOpenAI } from "./infer-all-field-with-openai";
import { inferWithGemini } from "./infer-all-field-with-gemini";

function isValidValue(value: any): boolean {
  return value !== null && value !== undefined && value !== "";
}

export async function inferWithEnsembleStrategy(
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<Record<string, any>> {
  const [openaiResult, geminiResult] = await Promise.allSettled([
    inferWithOpenAI(transcript, template),
    inferWithGemini(transcript, template),
  ]);

  const filledTemplate: Record<string, any> = {};
  const structure = template.structure ?? {};
  const fieldKeys = Object.keys(structure);

  for (const key of fieldKeys) {
    const openaiVal =
      openaiResult.status === "fulfilled" ? openaiResult.value[key] : undefined;
    const geminiVal =
      geminiResult.status === "fulfilled" ? geminiResult.value[key] : undefined;

    if (isValidValue(openaiVal) && isValidValue(geminiVal)) {
      filledTemplate[key] =
        openaiVal === geminiVal ? openaiVal : openaiVal; // Prefer OpenAI by default
    } else if (isValidValue(openaiVal)) {
      filledTemplate[key] = openaiVal;
    } else if (isValidValue(geminiVal)) {
      filledTemplate[key] = geminiVal;
    } else {
      filledTemplate[key] = null; // Let validation determine if it's required/missing
    }
  }

  return filledTemplate;
}
