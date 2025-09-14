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

  /**
   * Per-field fill. Minimal changes:
   * - Supports oldTranscript/newTranscript; still works if only `transcript` is passed.
   * - Prompts the model to use NEW transcript as the ONLY extraction source (old = context).
   * - Validates evidence: snippet MUST be found in NEW transcript, else treat as null.
   * - Returns `transcript: { old, new, combined }` in result (optional field to keep BC).
   */
  async getFilledTemplate(input: GetFilledTemplateInput): Promise<GetFilledTemplateResult & {
    transcript?: { old: string; new: string; combined: string };
  }> {
    const {
      // existing fields
      transcript: legacyTranscript,
      fields,
      currentValues,
      locale = "en-US",
      timezone = "Europe/Berlin",
      options,
      templateId,

      // NEW (optional) — won’t break callers that don’t send these:
      oldTranscript,
      newTranscript,
    } = input as GetFilledTemplateInput & {
      oldTranscript?: string | undefined;
      newTranscript?: string | undefined;
    };

    // Back-compat inputs:
    // - If caller provides new/old, use them.
    // - Else fall back to the single `transcript` as NEW (and OLD empty).
    const oldText = (oldTranscript ?? "").trim();
    const newText = (newTranscript ?? legacyTranscript ?? "").trim();

    if (!fields?.length) throw new Error("At least one template field is required.");
    if (!newText) throw new Error("Transcript is required."); // remain strict: we only extract from NEW

    const combinedTranscript = oldText ? `${oldText}\n${newText}` : newText;

    const modelName = process.env.OPENAI_FILL_MODEL || "gpt-4.1";

    const runField = async (field: FormTemplateField, current?: CurrentFieldValue) => {
      // Per-field schema
      const fieldSchema = z.object({
        value: zodFieldValueSchema(field),
        confidence: z.number().min(0).max(1).optional(),
        evidence: z.object({ transcriptSnippet: z.string().min(1).max(280).optional() }).optional(),
      });

      // Clear, minimal instructions emphasizing NEW vs OLD
      const rules: string[] = [
        `You must ONLY extract values from the NEW transcript.`,
        `The OLD transcript is context only; do NOT create or change values using OLD text.`,
        `If the NEW transcript does not mention this field, set value to null.`,
        `If you set a non-null value, include a literal snippet from the NEW transcript in evidence.transcriptSnippet (<= 200 chars).`,
        `Dates MUST be ISO YYYY-MM-DD. Numbers must be plain decimals/integers (no units).`,
      ];
      if (field.type === "enum" && field.options?.length) {
        rules.push(`For enums, ONLY use one of the provided options exactly: ${field.options.join(", ")}`);
      }
      if (options?.returnEvidence) {
        rules.push(`Always include evidence.transcriptSnippet when value is non-null.`);
      }

      const prompt = [
        `Template ID: ${templateId ?? "(unspecified)"} | Locale: ${locale} | Timezone: ${timezone}`,
        ``,
        `Field: ${field.label} (id: ${field.id}, type: ${field.type}${field.required ? ", required" : ""})`,
        current
          ? `Current value: ${JSON.stringify(current.value)} (source: ${current.source ?? "ai"}, locked: ${!!current.locked})`
          : `Current value: null`,
        ``,
        `Rules:`,
        ...rules.map((r) => `- ${r}`),
        ``,
        `OLD transcript (context only; do not extract from this):`,
        oldText || "(empty)",
        ``,
        `NEW transcript (extract ONLY from this):`,
        newText,
      ].join("\n");

      const { object } = await generateObject({
        model: openai(modelName),
        schema: fieldSchema,
        prompt,
      });

      // Proposed value from the model
      const raw = object?.value ?? null;
      let proposed = isEmptyValue(raw) ? null : raw;

      // Evidence must be a snippet from NEW transcript (enforced here)
      const snippet = object?.evidence?.transcriptSnippet?.trim() || "";
      const snippetFoundInNew =
        proposed !== null &&
        !!snippet &&
        newText.toLowerCase().includes(snippet.toLowerCase());

      if (proposed !== null && !snippetFoundInNew) {
        // Reject updates not grounded in NEW transcript
        proposed = null;
      }

      // Overwrite policy (unchanged): if current is locked, keep it; else overwrite only with non-null proposed
      const currentVal = current?.value ?? null;
      let finalVal: string | number | null;
      let usedProposed = false;

      if (current?.locked) {
        finalVal = currentVal;
      } else {
        if (proposed !== null) {
          finalVal = proposed;  // overwrite only when grounded in NEW
          usedProposed = true;
        } else {
          finalVal = currentVal; // keep existing if no grounded update
        }
      }

      const changed = (currentVal ?? null) !== (finalVal ?? null);
      const previousValue = changed ? (currentVal ?? null) : undefined;

      // For offsets, use the combined transcript so UI can highlight accurately;
      // snippet is from NEW, but combined makes searching robust either way.
      const offsets = attachOffsetsFromSnippet(combinedTranscript, snippet || undefined);

      const filled: FilledField = {
        value: finalVal,
        confidence: usedProposed ? object?.confidence : undefined,
        changed,
        previousValue,
        source: usedProposed ? "ai" : (current?.source === "user" ? "user" : "ai"),
        evidence: {
          transcriptSnippet: snippet || undefined,
          ...offsets,
        },
      };

      return [field.id, filled] as const;
    };

    // Run all fields in parallel (kept as-is)
    const tasks = fields.map((f) => runField(f, currentValues?.[f.id]));
    const entries = await Promise.all(tasks);

    // Keep original shape; add transcript summary optionally (minimizes ripple)
    return {
      filled: Object.fromEntries(entries),
      model: modelName,
      transcript: { old: oldText, new: newText, combined: combinedTranscript },
    } as GetFilledTemplateResult & {
      transcript: { old: string; new: string; combined: string };
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
