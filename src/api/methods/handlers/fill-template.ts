import { preprocessTranscript } from "./preprocess";
import { inferWithOpenAI } from "./strategies/infer-all-field-with-openai";
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
import { inferWithGemini } from "./strategies/infer-all-field-with-gemini";

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
  if (!templateDefinition?.structure || Object.keys(templateDefinition.structure).length === 0)
  throw new Error("Template structure is required");

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
          console.log("Processing with OneModelAllQuestion strategy", preprocessed, enhanced);
          raw = await inferWithGemini(preprocessed, enhanced);
          console.log("Inference result:", raw);
          break;

        case ProcessingType.OneModelOneQuestion:
          console.log("Processing with OneModelOneQuestion strategy", preprocessed, enhanced);
          raw = await inferEachFieldIndividually(preprocessed, enhanced);
          console.log("Inference result:", raw);
          break;

        case ProcessingType.MultiModelOneQuestion:
          // Example: run multiple prompts per field, choose best answer
          raw = await inferWithVotingStrategy(preprocessed, enhanced);
          break;

        case ProcessingType.MultiModelAllQuestion:
          console.log("Processing with MultiModelAllQuestion strategy", preprocessed, enhanced);
          // Example: run multiple models or prompts on entire field set
          raw = await inferWithEnsembleStrategy(preprocessed, enhanced);
          console.log("Inference result:", raw);
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
