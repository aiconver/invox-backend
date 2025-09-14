import { experimental_transcribe as transcribe, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import {
  type UploadFile,
  type TranscribeResponse,
  type GetFilledTemplateInput,
  type GetFilledTemplateResult,
  type FilledField,
  type FormTemplateField,
  type CurrentFieldValue,
  zodFieldValueSchema,
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

  /** Simple per-field fill: one call per field (parallel). Overwrite unless locked; null/empty keeps current. */
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

    const runField = async (field: FormTemplateField, current?: CurrentFieldValue) => {
      // Per-field schema
      const fieldSchema = z.object({
        value: zodFieldValueSchema(field),
        confidence: z.number().min(0).max(1).optional(),
        evidence: z.object({ transcriptSnippet: z.string().min(1).max(280).optional() }).optional(),
      });

      // Minimal, focused prompt for this single field
      const lines: string[] = [
        `You fill exactly ONE field from the transcript.`,
        `If unknown or not stated, set value to null.`,
        `Dates MUST be ISO YYYY-MM-DD.`,
        `Numbers must be plain decimals/integers (no units).`,
      ];
      if (field.type === "enum" && field.options?.length) {
        lines.push(`For enums, ONLY use one of the provided options exactly.`);
        lines.push(`Options: ${field.options.join(", ")}`);
      }
      if (options?.returnEvidence) {
        lines.push(`Include a SHORT supporting snippet in evidence.transcriptSnippet (<= 200 chars) when setting a value.`);
      }

      const prompt = [
        `Template ID: ${templateId ?? "(unspecified)"} | Locale: ${locale} | Timezone: ${timezone}`,
        ``,
        `Field: ${field.label} (id: ${field.id}, type: ${field.type}${field.required ? ", required" : ""})`,
        current
          ? `Current value: ${JSON.stringify(current.value)} (source: ${current.source ?? "ai"}, locked: ${!!current.locked})`
          : `Current value: null`,
        ``,
        ...lines,
        ``,
        `Transcript:`,
        transcript,
      ].join("\n");

      const { object } = await generateObject({
        model: openai(modelName),
        schema: fieldSchema,
        prompt,
      });

      // Normalize + overwrite policy
      const raw = object?.value ?? null;
      const proposed = isEmptyValue(raw) ? null : raw;
      const currentVal = current?.value ?? null;

      let finalVal: string | number | null;
      let usedProposed = false;

      if (current?.locked) {
        finalVal = currentVal;
      } else {
        if (proposed !== null) {
          finalVal = proposed;  // overwrite
          usedProposed = true;
        } else {
          finalVal = currentVal; // keep existing if model has nothing
        }
      }

      const changed = (currentVal ?? null) !== (finalVal ?? null);
      const previousValue = changed ? (currentVal ?? null) : undefined;
      const offsets = attachOffsetsFromSnippet(transcript, object?.evidence?.transcriptSnippet);

      const filled: FilledField = {
        value: finalVal,
        confidence: usedProposed ? object?.confidence : undefined,
        changed,
        previousValue,
        source: usedProposed ? "ai" : (current?.source === "user" ? "user" : "ai"),
        evidence: {
          transcriptSnippet: object?.evidence?.transcriptSnippet,
          ...offsets,
        },
      };

      return [field.id, filled] as const;
    };

    // Run all fields in parallel
    const tasks = fields.map((f) => runField(f, currentValues?.[f.id]));
    const entries = await Promise.all(tasks);

    return {
      filled: Object.fromEntries(entries),
      model: modelName,
    };
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
