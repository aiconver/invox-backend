import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  FormTemplateField,
  CurrentFieldValue,
  FilledField,
  zodFieldValueSchema,
  attachOffsetsFromSnippet,
  isEmptyValue,
} from "../registry";
import { buildPrompt } from "./promptBuilder";

export async function runField({
  field,
  oldText,
  newText,
  combinedTranscript,
  templateId,
  locale,
  timezone,
  fewShots,
  options,
  current,
  modelName,
}: {
  field: FormTemplateField;
  oldText: string;
  newText: string;
  combinedTranscript: string;
  templateId?: string;
  locale: string;
  timezone: string;
  fewShots?: any[];
  options?: any;
  current?: CurrentFieldValue;
  modelName: string;
}): Promise<[string, FilledField]> {
  const fieldSchema = z.object({
    value: zodFieldValueSchema(field),
    confidence: z.number().min(0).max(1).optional(),
    evidence: z.object({ transcriptSnippet: z.string().min(1).max(200).optional() }).optional(),
  });

  // Build examples
  const perFieldDemos = (fewShots ?? [])
    .filter(ex => ex.expected?.hasOwnProperty(field.id))
    .slice(0, 3)
    .map(ex => {
      const expectedVal = ex.expected[field.id];
      const txt = String(ex.text).trim().slice(0, 500);
      const expectedStr = expectedVal === null ? "null" : JSON.stringify(expectedVal);
      return `Example\nNEW transcript: ${txt}\nExpected ${field.label}: ${expectedStr}`;
    });

  const rules = [
    `You must ONLY extract values from the NEW transcript.`,
    `The OLD transcript is context only; do NOT use it.`,
    `If the NEW transcript does not mention this field, set value to null.`,
    `Dates MUST be ISO YYYY-MM-DD. Numbers must be plain decimals/integers.`,
  ];
  if (field.type === "enum" && field.options?.length) {
    rules.push(`For enums, ONLY use one of: ${field.options.join(", ")}`);
  }
  if (options?.returnEvidence) {
    rules.push(`When value is non-null, include transcriptSnippet from NEW transcript (<=200 chars).`);
  }

  const descLine = field.description ? `Field description: ${field.description.slice(0, 240)}` : null;

  const prompt = buildPrompt({
    field,
    oldText,
    newText,
    templateId,
    locale,
    timezone,
    descLine,
    perFieldDemos,
    rules,
    currentValue: current?.value,
  });

  const { object } = await generateObject({
    model: openai(modelName),
    schema: fieldSchema,
    prompt,
  });

  const raw = object?.value ?? null;
  let proposed = isEmptyValue(raw) ? null : raw;

  const snippet = object?.evidence?.transcriptSnippet?.trim() || "";
  const snippetFoundInNew =
    proposed !== null &&
    !!snippet &&
    newText.toLowerCase().includes(snippet.toLowerCase());
  if (proposed !== null && !snippetFoundInNew) {
    proposed = null;
  }

  const currentVal = current?.value ?? null;
  let finalVal = currentVal;
  let usedProposed = false;
  if (!current?.locked && proposed !== null) {
    finalVal = proposed;
    usedProposed = true;
  }

  const changed = (currentVal ?? null) !== (finalVal ?? null);
  const previousValue = changed ? currentVal ?? null : undefined;

  const offsets = attachOffsetsFromSnippet(combinedTranscript, snippet || undefined);

  return [
    field.id,
    {
      value: finalVal,
      confidence: usedProposed ? object?.confidence : undefined,
      changed,
      previousValue,
      source: usedProposed ? "ai" : (current?.source ?? "ai"),
      evidence: {
        transcriptSnippet: snippet || undefined,
        ...offsets,
      },
    },
  ];
}
