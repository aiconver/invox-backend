import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { buildPrompt } from "./prompt-builder";
import {
  CurrentFieldValue,
  FilledField,
  FormTemplateField,
} from "@/types/fill-form";

/** ───────── helpers (inlined) ───────── */

function zodFieldValueSchema(field: FormTemplateField): z.ZodTypeAny {
  switch (field.type) {
    case "date":
      // ISO date YYYY-MM-DD or null
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
    case "number":
      return z.number().finite().nullable();
    case "enum":
      if (field.options?.length) {
        // use enum of provided options or null
        return z.enum(field.options as [string, ...string[]]).nullable();
      }
      return z.string().nullable();
    case "text":
    case "textarea":
    default: {
      if (field.pattern) {
        try {
          const re = new RegExp(field.pattern);
          return z.string().regex(re).nullable();
        } catch {
          // bad regex → fallback to free string/null
          return z.string().nullable();
        }
      }
      return z.string().nullable();
    }
  }
}

function attachOffsetsFromSnippet(
  transcript: string,
  snippet?: string
): { startChar?: number; endChar?: number } {
  if (!snippet) return {};
  const idx = transcript.indexOf(snippet);
  if (idx < 0) return {};
  return { startChar: idx, endChar: idx + snippet.length };
}

function isEmptyValue(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function isDE(lang?: string) {
  return (lang ?? "en").toLowerCase().startsWith("de");
}

/** ───────── main function ───────── */

export async function runField({
  field,
  oldText,
  newText,
  combinedTranscript,
  templateId,
  lang,
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
  lang: string; // "en" | "de"
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
    evidence: z
      .object({ transcriptSnippet: z.string().min(1).max(200).optional() })
      .optional(),
  });

  const de = isDE(lang);

  // Localized few-shot demos for this field
  const perFieldDemos = (fewShots ?? [])
    .filter((ex: any) => ex?.expected?.hasOwnProperty(field.id))
    .slice(0, 3)
    .map((ex: any) => {
      const expectedVal = ex.expected[field.id];
      const txt = String(ex.text).trim().slice(0, 500);
      const expectedStr = expectedVal === null ? "null" : JSON.stringify(expectedVal);
      const exampleLabel = de ? "Beispiel" : "Example";
      const newLabel = de ? "NEUES Transkript" : "NEW transcript";
      const expectedLabel = de ? "Erwartet" : "Expected";
      return `${exampleLabel}
${newLabel}: ${txt}
${expectedLabel} ${field.label}: ${expectedStr}`;
    });

  // Localized extraction rules
  const rules: string[] = de
    ? [
        "Werte NUR aus dem NEUEN Transkript extrahieren.",
        "Das ALTE Transkript dient nur als Kontext; NICHT daraus ableiten.",
        "Wenn das NEUE Transkript dieses Feld nicht erwähnt, setze value auf null.",
        "Datumsangaben MÜSSEN im ISO-Format YYYY-MM-DD sein. Zahlen als reine Dezimal-/Ganzzahlen (ohne Einheiten).",
      ]
    : [
        "You must ONLY extract values from the NEW transcript.",
        "The OLD transcript is context only; do NOT use it.",
        "If the NEW transcript does not mention this field, set value to null.",
        "Dates MUST be ISO YYYY-MM-DD. Numbers must be plain decimals/integers (no units).",
      ];

  if (field.type === "enum" && field.options?.length) {
    rules.push(
      de
        ? `Für Enums NUR eine der vorgegebenen Optionen exakt verwenden: ${field.options.join(
            ", "
          )}`
        : `For enums, ONLY use one of the provided options exactly: ${field.options.join(", ")}`
    );
  }
  if (options?.returnEvidence) {
    rules.push(
      de
        ? "Wenn value nicht null ist, füge ein wörtliches Snippet aus dem NEUEN Transkript in evidence.transcriptSnippet ein (≤ 200 Zeichen)."
        : "When value is non-null, include a literal snippet from the NEW transcript in evidence.transcriptSnippet (≤ 200 chars)."
    );
  }

  const descLine = field.description
    ? (de ? "Feldbeschreibung: " : "Field description: ") +
      field.description.slice(0, 240)
    : null;

  const prompt = buildPrompt({
    field,
    oldText,
    newText,
    templateId,
    lang,
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

  // Proposed value from model
  const raw = object?.value ?? null;
  let proposed = isEmptyValue(raw) ? null : (raw as FilledField["value"]);

  // Evidence must come from NEW transcript
  const snippet = object?.evidence?.transcriptSnippet?.trim() || "";
  const snippetFoundInNew =
    proposed !== null &&
    !!snippet &&
    newText.toLowerCase().includes(snippet.toLowerCase());

  if (proposed !== null && !snippetFoundInNew) {
    // reject evidence that can't be found in NEW transcript
    proposed = null;
  }

  // Overwrite policy
  const currentVal = current?.value ?? null;
  let finalVal = currentVal;
  let usedProposed = false;
  if (!current?.locked && proposed !== null) {
    finalVal = proposed;
    usedProposed = true;
  }

  const changed = (currentVal ?? null) !== (finalVal ?? null);
  const previousValue = changed ? (currentVal ?? null) : undefined;

  // Offsets (search over combined; snippet is from NEW)
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
