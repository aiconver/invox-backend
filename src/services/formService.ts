// src/services/formService.ts
import { experimental_transcribe as transcribe, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

/** ---------- existing types ---------- */
export type TranscribeResponse = {
  transcript: string;
  language?: string;
  durationInSeconds?: number;
};

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

/** ---------- new types for template filling ---------- */
export type FieldType = "text" | "textarea" | "date" | "number" | "enum";

export type FormTemplateField = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** for enum */
  options?: string[];
  /** optional regex pattern for text fields */
  pattern?: string;
};

export type CurrentFieldValue = {
  value: string | number | null;
  source?: "user" | "ai";
  locked?: boolean; // if true, never overwrite
};

export type GetFilledTemplateInput = {
  templateId?: string;
  fields: FormTemplateField[];
  transcript: string;
  currentValues?: Record<string, CurrentFieldValue>;
  locale?: string;
  timezone?: string;
  options?: {
    mode?: "incremental" | "fresh";
    fillOnlyEmpty?: boolean; // only fill if current value is empty/null
    preserveUserEdits?: boolean; // prefer user source values
    returnEvidence?: boolean; // ask model to include a short snippet
  };
};

export type FilledField = {
  value: string | number | null;
  confidence?: number;
  changed?: boolean;
  previousValue?: string | number | null;
  source: "ai" | "user";
  evidence?: {
    transcriptSnippet?: string;
    startChar?: number;
    endChar?: number;
  };
};

export type GetFilledTemplateResult = {
  filled: Record<string, FilledField>;
  model: string;
  traceId?: string;
};

/** ---------- helpers: dynamic schema & prompt ---------- */

function zodFieldValueSchema(field: FormTemplateField): z.ZodTypeAny {
  switch (field.type) {
    case "date":
      // ISO 8601 date (YYYY-MM-DD) or null
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
    case "number":
      return z.number().finite().nullable();
    case "enum":
      if (field.options?.length) {
        return z.enum(field.options as [string, ...string[]]).nullable();
      }
      return z.string().nullable(); // fallback
    case "text":
    case "textarea":
    default:
      if (field.pattern) {
        try {
          const re = new RegExp(field.pattern);
          return z.string().regex(re).nullable();
        } catch {
          // invalid pattern: fall back to plain string
          return z.string().nullable();
        }
      }
      return z.string().nullable();
  }
}

function buildResultSchema(fields: FormTemplateField[]) {
  // For each field, expect { value, confidence?, evidence? }
  const entries = Object.fromEntries(
    fields.map((f) => [
      f.id,
      z.object({
        value: zodFieldValueSchema(f),
        confidence: z.number().min(0).max(1).optional(),
        // model returns a short snippet; we'll compute offsets server-side
        evidence: z
          .object({
            transcriptSnippet: z.string().min(1).max(280).optional(),
          })
          .optional(),
      }),
    ])
  );
  return z.object(entries);
}

function isEmptyValue(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function formatTemplateForPrompt(fields: FormTemplateField[]): string {
  return fields
    .map((f) => {
      const base = `- id: ${f.id} | label: ${f.label} | type: ${f.type}${
        f.required ? " (required)" : ""
      }`;
      if (f.type === "enum" && f.options?.length) {
        return `${base} | options: [${f.options.join(", ")}]`;
      }
      return base;
    })
    .join("\n");
}

function formatCurrentValuesForPrompt(
  currentValues: Record<string, CurrentFieldValue> | undefined
): string {
  if (!currentValues) return "(none)";
  const lines = Object.entries(currentValues).map(([id, v]) => {
    const val =
      typeof v?.value === "string" || typeof v?.value === "number"
        ? JSON.stringify(v.value)
        : "null";
    return `- ${id}: ${val} (source: ${v.source ?? "ai"}, locked: ${
      v.locked ? "true" : "false"
    })`;
  });
  return lines.join("\n");
}

/** Computes start/end offsets for evidence snippet if present */
function attachOffsetsFromSnippet(
  transcript: string,
  snippet?: string
): { startChar?: number; endChar?: number } {
  if (!snippet) return {};
  const idx = transcript.indexOf(snippet);
  if (idx < 0) return {};
  return { startChar: idx, endChar: idx + snippet.length };
}

/** ---------- service ---------- */

export class formService {
  /**
   * Takes a raw uploaded audio file (buffer) and returns its transcript
   * using Vercel AI SDK transcription.
   */
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
   * Fill a template from a transcript + current values using Vercel AI SDK.
   * - Respects locked fields (won't overwrite).
   * - If preserveUserEdits, prefers values whose source === 'user'.
   * - If fillOnlyEmpty, only proposes values for empty/null fields.
   */
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

    if (!transcript?.trim()) {
      throw new Error("Transcript is required.");
    }
    if (!fields?.length) {
      throw new Error("At least one template field is required.");
    }

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
      options?.fillOnlyEmpty
        ? "- Fill ONLY fields that are currently empty/null."
        : "- You MAY update existing values if the transcript clearly indicates a better value.",
      options?.preserveUserEdits
        ? "- If a field's source is 'user', prefer the user value unless the transcript explicitly contradicts it."
        : "",
      "- If a field is locked, DO NOT change it.",
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

    // Post-process: enforce locked/fillOnlyEmpty/preserveUserEdits and compute changed/previous/evidence offsets
    const filled: Record<string, FilledField> = {};
    for (const f of fields) {
      const proposed = extracted[f.id] as {
        value: string | number | null;
        confidence?: number;
        evidence?: { transcriptSnippet?: string };
      };

      const current = currentValues?.[f.id];
const proposedValRaw = proposed?.value ?? null;
const proposedValue = isEmptyValue(proposedValRaw) ? null : proposedValRaw;
const currentValue = current?.value ?? null;
const currentEmpty = isEmptyValue(currentValue);

let finalValue = proposedValue;
let usedProposed = true;

// Respect locked
if (current?.locked) {
  finalValue = currentValue;
  usedProposed = false;
} else {
  // Preserve user edits only if they are non-empty
  if (options?.preserveUserEdits && current?.source === "user" && !currentEmpty) {
    finalValue = currentValue;
    usedProposed = false;
  }
  // Fill only empty fields (if requested)
  else if (options?.fillOnlyEmpty && !currentEmpty) {
    finalValue = currentValue;
    usedProposed = false;
  }
}

// Detect change
const changed = (currentValue ?? null) !== (finalValue ?? null);
const previousValue = changed ? (currentValue ?? null) : undefined;

const offsets = attachOffsetsFromSnippet(
  transcript,
  proposed?.evidence?.transcriptSnippet
);

// Mark source based on which value we kept
const source: "ai" | "user" = usedProposed ? "ai" : (current?.source === "user" ? "user" : "ai");

filled[f.id] = {
  value: finalValue,
  confidence: proposed?.confidence,
  changed,
  previousValue,
  source,
  evidence: {
    transcriptSnippet: proposed?.evidence?.transcriptSnippet,
    ...offsets,
  },
};
    }

    return {
      filled,
      model: modelName,
    };
  }

  /// more service for form yet
}
