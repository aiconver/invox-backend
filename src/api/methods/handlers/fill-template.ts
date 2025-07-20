import { preprocessTranscript } from "./preprocess";
import { inferWithOpenAI } from "./strategies/infer-all-field";
import { validateAndPostProcess } from "./validate";
import {
  EnhancedTemplateDefinition,
  TemplateDefinition,
  ExtractionResult,
} from "../types";
import { inferEachFieldIndividually } from "./strategies/infer-each-field-individually";
import { inferWithVotingStrategy } from "./strategies/infer-with-voting-strategy";
import { inferWithEnsembleStrategy } from "./strategies/infer-with-ensemble-strategy";
import { inferWithHybridStrategy } from "./strategies/infer-with-hybrid-strategy";
import { ProcessingType } from "@/db/models/enums";

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

  const processingType = (templateDefinition as EnhancedTemplateDefinition).processingType ?? ProcessingType.OneModelAllQuestion;

  const enhanced: EnhancedTemplateDefinition = {
    ...templateDefinition,
    context: (templateDefinition as EnhancedTemplateDefinition).context,
    priority: (templateDefinition as EnhancedTemplateDefinition).priority,
    processingType,
  };

  const preprocessed = preprocessTranscript(transcript);
  const retries = options.maxRetries ?? 2;
  const confidenceThreshold = options.confidenceThreshold ?? 0.7;

  let attempt = 0;

  while (attempt <= retries) {
    try {
      let raw;

      switch (processingType) {
        case ProcessingType.OneModelAllQuestion:
          raw = await inferWithOpenAI(preprocessed, enhanced);
          break;

        case ProcessingType.OneModelOneQuestion:
          // You'd need to define `inferEachFieldIndividually(preprocessed, enhanced)`
          raw = await inferEachFieldIndividually(preprocessed, enhanced);
          break;

        case ProcessingType.MultiModelOneQuestion:
          // Example: run multiple prompts per field, choose best answer
          raw = await inferWithVotingStrategy(preprocessed, enhanced);
          break;

        case ProcessingType.MultiModelAllQuestion:
          // Example: run multiple models or prompts on entire field set
          raw = await inferWithEnsembleStrategy(preprocessed, enhanced);
          break;

        case ProcessingType.HybridFeedback:
          // Example: may use system feedback or user interaction to improve output
          raw = await inferWithHybridStrategy(preprocessed, enhanced);
          break;

        default:
          throw new Error(`Unsupported processingType: ${processingType}`);
      }

      return await validateAndPostProcess(raw, enhanced, confidenceThreshold);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      attempt++;
    }
  }

  throw new Error("All attempts failed");
};
