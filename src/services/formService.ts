import { experimental_transcribe as transcribe, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  type UploadFile,
  type TranscribeResponse,
  type GetFilledTemplateInput,
  type GetFilledTemplateResult,
  type FilledField,
  buildResultSchema,
  formatTemplateForPrompt,
  formatCurrentValuesForPrompt,
  attachOffsetsFromSnippet,
  isEmptyValue,
} from "./registry";

export class formService {
  /** Transcribe raw audio buffer using Vercel AI SDK */
  async getAudioTranscript(file: UploadFile): Promise<TranscribeResponse> {
    if (!file?.buffer?.length) throw new Error("No audio data provided.");

    const modelName = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
    const result = await transcribe({
      model: openai.transcription(modelName as any),
      audio: file.buffer,
    });

    return {
      transcript: result.text ?? "",
      language: result.language,
      durationInSeconds: result.durationInSeconds,
    };
  }

  /** Fill template from transcript + (optional) current values — simple overwrite policy */
  async getFilledTemplate(input: GetFilledTemplateInput): Promise<GetFilledTemplateResult> {
    const {
      transcript,
      fields,
      currentValues,
      locale = "en-US",
      timezone = "Europe/Berlin",
      options,
      templateId,
    } = input;

    if (!transcript?.trim()) throw new Error("Transcript is required.");
    if (!fields?.length) throw new Error("At least one template field is required.");

    const modelName = process.env.OPENAI_FILL_MODEL || "gpt-4.1";
    const schema = buildResultSchema(fields);

    const guidance = [
      "You are a careful information extraction engine.",
      "Task: produce values for each field from the transcript.",
      "Rules:",
      "- If a field is unknown or not present, set value to null.",
      "- Dates MUST be ISO format YYYY-MM-DD.",
      "- Numbers must be plain decimals/integers (no units).",
      "- For enums, ONLY use one of the provided options exactly.",
      options?.returnEvidence
        ? "- When you change or set a value, include a SHORT supporting snippet from the transcript in evidence.transcriptSnippet (<= 200 chars)."
        : "- evidence.transcriptSnippet is optional.",
      "- confidence should be between 0 and 1.",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = [
      `Template ID: ${templateId ?? "(unspecified)"}`,
      `Locale: ${locale} | Timezone: ${timezone}`,
      "",
      "Template fields:",
      formatTemplateForPrompt(fields),
      "",
      "Current values:",
      formatCurrentValuesForPrompt(currentValues),
      "",
      "Transcript:",
      transcript,
      "",
      "Instructions:",
      guidance,
    ].join("\n");

    const { object: extracted } = await generateObject({
      model: openai(modelName),
      schema,
      prompt,
    });

    // Simple post-process: use AI proposal unless locked; if AI null/empty, keep current
    const filled: Record<string, FilledField> = {};
    for (const f of fields) {
      const proposed = extracted[f.id] as {
        value: string | number | null;
        confidence?: number;
        evidence?: { transcriptSnippet?: string };
      };

      const current = currentValues?.[f.id];

      const raw = proposed?.value ?? null;
      const proposedValue = isEmptyValue(raw) ? null : (raw as string | number | null);
      const currentValue = current?.value ?? null;

      let finalValue: string | number | null;
      let usedProposed = false;

      if (current?.locked) {
        finalValue = currentValue; // respect locks
      } else {
        if (proposedValue !== null) {
          finalValue = proposedValue; // overwrite
          usedProposed = true;
        } else {
          finalValue = currentValue; // keep what we have
        }
      }

      const changed = (currentValue ?? null) !== (finalValue ?? null);
      const previousValue = changed ? (currentValue ?? null) : undefined;

      const offsets = attachOffsetsFromSnippet(
        transcript,
        proposed?.evidence?.transcriptSnippet
      );

      filled[f.id] = {
        value: finalValue,
        confidence: usedProposed ? proposed?.confidence : undefined,
        changed,
        previousValue,
        source: usedProposed ? "ai" : (current?.source === "user" ? "user" : "ai"),
        evidence: {
          transcriptSnippet: proposed?.evidence?.transcriptSnippet,
          ...offsets,
        },
      };
    }

    return { filled, model: modelName };
  }
}

/** Re-export types so existing imports from "@/services/formService" keep working */
export type {
  TranscribeResponse,
  UploadFile,
  GetFilledTemplateInput,
  GetFilledTemplateResult,
  FilledField,
} from "./registry";
