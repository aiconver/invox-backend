import {
  CurrentFieldValue,
  FilledField,
  FormTemplateField,
  GetFilledTemplateInput,
  GetFilledTemplateResult,
} from "@/types/fill-form";
import { generateChatResponse } from "./utils/chatbot-helper";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { runVerifier } from "./utils/verifier";

/** ───────── types ───────── */
type LlmFieldResult = {
  value?: unknown | null;
  confidence?: number;
  evidence?: { transcriptSnippet?: string };
};
type LlmAllResult = Record<string, LlmFieldResult>;

/** ───────── helpers ───────── */
function zodFieldValueSchema(field: FormTemplateField): z.ZodTypeAny {
  switch (field.type) {
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
    case "number":
      return z.number().finite().nullable();
    case "enum":
      return field.options?.length
        ? z.enum(field.options as [string, ...string[]]).nullable()
        : z.string().nullable();
    default:
      return z.string().nullable();
  }
}

function isDE(lang?: string) {
  return (lang ?? "en").toLowerCase().startsWith("de");
}

function formatCurrentValues(
  fields: FormTemplateField[],
  currentValues?: Record<string, CurrentFieldValue>
) {
  return fields.map((f) => {
    const cv = currentValues?.[f.id];
    return {
      id: f.id,
      label: f.label,
      type: f.type,
      locked: !!cv?.locked,
      value: cv?.value ?? null,
    };
  });
}

function buildPrompt({
  fields,
  oldText,
  newText,
  fewShots,
  lang,
  currentValues,
}: {
  fields: FormTemplateField[];
  oldText: string;
  newText: string;
  fewShots?: any[];
  lang: string;
  currentValues?: Record<string, CurrentFieldValue>;
}) {
  const de = isDE(lang);

  const header = de
    ? [
        "Aufgabe: Erstelle die endgültigen Feldwerte.",
        "Nur das NEUE Transkript ist Quelle für neue Informationen.",
        "Wenn das NEUE Transkript für ein Feld KEINE Information liefert, BEHALTE den aktuellen Wert.",
        "Aktualisiere NUR, wenn das NEUE Transkript klare Evidenz enthält.",
        "locked=true Felder NIEMALS überschreiben.",
        "Datumsformat: YYYY-MM-DD. Zahlen ohne Einheiten.",
        "Antwort NUR im JSON-Format: { fieldId: { value, confidence?, evidence? } }",
      ].join(" ")
    : [
        "Task: Produce the FINAL values for each field.",
        "Only the NEW transcript is the source for new info.",
        "If the NEW transcript does NOT mention a field, KEEP the current value.",
        "Update ONLY when the NEW transcript provides clear evidence.",
        "For locked=true fields, NEVER overwrite.",
        "Dates must be YYYY-MM-DD. Numbers plain (no units).",
        "Answer ONLY with JSON: { fieldId: { value, confidence?, evidence? } }",
      ].join(" ");

  const fs = (fewShots ?? [])
    .slice(0, 2)
    .map((ex: any, i: number) => {
      const expected = JSON.stringify(ex.expected, null, 2);
      return de
        ? `Beispiel ${i + 1}:\nText: ${ex.text}\nErwartet: ${expected}`
        : `Example ${i + 1}:\nText: ${ex.text}\nExpected: ${expected}`;
    })
    .join("\n\n");

  const fieldList = fields
    .map((f) => `${f.id} (${f.label}, type=${f.type}${f.required ? ", required" : ""})`)
    .join("\n");

  const oldLabel = de ? "ALTES Transkript:" : "OLD transcript:";
  const newLabel = de ? "NEUES Transkript:" : "NEW transcript:";
  const currentLabel = de ? "Aktuelle Werte:" : "Current values:";

  return [
    header,
    "",
    fs,
    "",
    de ? "Felder:" : "Fields:",
    fieldList,
    "",
    currentLabel,
    JSON.stringify(formatCurrentValues(fields, currentValues), null, 2),
    "",
    oldLabel,
    oldText || "(leer)",
    "",
    newLabel,
    newText,
  ].join("\n");
}
export async function singleLlmAllField(
  input: GetFilledTemplateInput
): Promise<GetFilledTemplateResult> {
  const {
    transcript: legacyTranscript,
    fields,
    lang,
    currentValues,
    oldTranscript,
    newTranscript,
    fewShots,
  } = input as GetFilledTemplateInput & { oldTranscript?: string; newTranscript?: string };

  const oldText = (oldTranscript ?? "").trim();
  const newText = (newTranscript ?? legacyTranscript ?? "").trim();
  const combinedTranscript = oldText ? `${oldText}\n${newText}` : newText;

  if (!fields?.length) throw new Error("At least one field is required.");
  if (!newText) throw new Error("Transcript is required.");

  const modelName = process.env.OPENAI_FILL_MODEL || "gpt-4.1";

  console.log("\n[=== singleLlmAllField START ===]");
  console.log("Model:", modelName);
  console.log("Fields:", fields.map(f => ({ id: f.id, label: f.label, type: f.type })));
  console.log("Current values:", currentValues);
  console.log("Old transcript:", oldText);
  console.log("New transcript:", newText);

  // Extractor returns value (+ optional evidence); no confidence here.
  const schema = z.object(
    Object.fromEntries(
      fields.map((f) => [
        f.id,
        z.object({
          value: zodFieldValueSchema(f),
          evidence: z.object({ transcriptSnippet: z.string().optional() }).optional(),
        }),
      ])
    )
  );

  const prompt = buildPrompt({ fields, oldText, newText, fewShots, lang, currentValues });
  console.log("Prompt:\n", prompt);

  const t0 = Date.now();
  const { object } = await generateObject({
    model: openai(modelName),
    schema,
    prompt,
  });
  console.log(`LLM responded in ${Date.now() - t0}ms`);
  console.log("Raw LLM output:", JSON.stringify(object, null, 2));

  // Build filled map (no confidence yet)
  const raw = object as Record<string, { value?: unknown | null; evidence?: { transcriptSnippet?: string } }>;
  const filled: Record<string, FilledField> = {};
  for (const f of fields) {
    const prev = currentValues?.[f.id];
    const prevVal = prev?.value ?? null;
    const r = raw?.[f.id] ?? {};
    const hasNew = r.value !== undefined; // undefined => not mentioned => keep previous
    const finalVal = hasNew ? (r.value as FilledField["value"]) : prevVal;
    const changed = hasNew ? finalVal !== prevVal : false;

    filled[f.id] = {
      value: finalVal ?? null,
      changed,
      previousValue: changed ? prevVal : undefined,
      source: changed ? "ai" : (prev?.source ?? "ai"),
      evidence: r.evidence,
    };

    if (changed) {
      console.log(`Field "${f.id}" changed:`, { from: prevVal, to: finalVal });
    } else {
      console.log(`Field "${f.id}" unchanged:`, finalVal ?? null);
    }
  }

  // Verifier pass (reusable util)
  const verifiedFilled = await runVerifier({
    combinedTranscript,
    fields,
    filled,
    lang: lang ?? "en",
  });

  const entries = Object.entries(verifiedFilled) as [string, FilledField][];
  const chatResponse = await generateChatResponse(combinedTranscript, fields, currentValues, entries);

  console.log("[=== singleLlmAllField END ===]\n");

  return {
    filled: verifiedFilled,
    model: modelName,
    transcript: { old: oldText, new: newText, combined: combinedTranscript },
    chatResponse,
  };
}
