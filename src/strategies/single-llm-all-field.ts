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
import { getFewShotsFromTranscript } from "./utils/get-few-shots";

/** ───────── logging helpers ───────── */
const DEBUG = process.env.DEBUG_FILL !== "0";
const DUMP_FULL_PROMPT = process.env.DUMP_FULL_PROMPT === "1";

function log(...args: any[]) {
  if (DEBUG) console.log(...args);
}
function warn(...args: any[]) {
  if (DEBUG) console.warn(...args);
}
function err(...args: any[]) {
  if (DEBUG) console.error(...args);
}
function short(value: unknown, max = 400) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + ` … [${s.length} chars]` : s;
}
function approxTokens(text: string) {
  // VERY rough heuristic; good enough for log awareness.
  return Math.ceil((text?.length ?? 0) / 4);
}
function maskSecret(s?: string | null) {
  if (!s) return "(missing)";
  if (s.length <= 8) return "*".repeat(s.length);
  return s.slice(0, 4) + "…" + s.slice(-4);
}

// Fields that can be multi-valued in MUC-4 and should accept string[] too
const MULTI_VALUE_FIELD_IDS = new Set([
  "perpetratorIndividual",
  "perpetratorOrganization",
  "target",
  "victim",
  "weapon",
]);

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
    default: {
    // text/textarea: allow string OR string[] for known multi-value fields
    if (MULTI_VALUE_FIELD_IDS.has(field.id)) {
      return z.union([z.string(), z.array(z.string())]).nullable();
    }
    return z.string().nullable();
  }
  }
}


function normalizeLLMValue(field: FormTemplateField, v: unknown) {
  if (v == null) return null;

  // For multi-value fields, turn ["A","B"] into "A, B"
  if (MULTI_VALUE_FIELD_IDS.has(field.id) && Array.isArray(v)) {
    const joined = v.map(x => String(x).trim()).filter(Boolean).join(", ");
    return joined || null;
  }

  // Trim plain strings
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }

  return v as any;
}


export function isDE(lang?: string) {
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
        "Antwort NUR im JSON-Format: { fieldId: { value} }",
      ].join(" ")
    : [
        "Task: Produce the FINAL values for each field.",
        "Only the NEW transcript is the source for new info.",
        "If the NEW transcript does NOT mention a field, KEEP the current value.",
        "Update ONLY when the NEW transcript provides clear evidence.",
        "For locked=true fields, NEVER overwrite.",
        "Dates must be YYYY-MM-DD. Numbers plain (no units).",
        "Answer ONLY with JSON: { fieldId: { value} }",
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

  // — replace the current fieldList builder with this —
  const fieldList = fields
    .map((f) => {
      const meta = `${f.id} (${f.label}, type=${f.type}${f.required ? ", required" : ""})`;
      const opts = f.type === "enum" && f.options?.length
        ? `\n  - ${de ? "Zulässige Werte" : "Allowed values"}: ${f.options.join(", ")}`
        : "";
      const desc = f.description
        ? `\n  - ${de ? "Leitlinien" : "Guidelines"}: ${f.description}`
        : "";
      return meta + opts + desc;
    })
    .join("\n\n");

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
  } = input as GetFilledTemplateInput & { oldTranscript?: string; newTranscript?: string };

  const oldText = (oldTranscript ?? "").trim();
  const newText = (newTranscript ?? legacyTranscript ?? "").trim();
  const combinedTranscript = oldText ? `${oldText}\n${newText}` : newText;

  const modelName = process.env.OPENAI_FILL_MODEL || "gpt-5";

  log("\n[=== singleLlmAllField START ===]");
  log("env.OPENAI_FILL_MODEL:", modelName);
  log("env.OPENAI_API_KEY present:", maskSecret(process.env.OPENAI_API_KEY));
  log("Lang:", lang ?? "en");
  log(
    "Fields:",
    fields.map((f) => ({ id: f.id, type: f.type, required: !!f.required }))
  );
  log("Current values keys:", Object.keys(currentValues ?? {}));
  log("Old transcript (preview):", short(oldText, 300));
  log("New transcript (preview):", short(newText, 300));

  if (!fields?.length) {
    err("[error] No fields provided");
    throw new Error("At least one field is required.");
  }
  if (!newText) {
    err("[error] No new transcript provided");
    throw new Error("Transcript is required.");
  }

  // Retrieve few-shots with timing + error guard
  let fewShots: any[] = [];
  try {
    console.time("[timer] fewShots");
    fewShots = await getFewShotsFromTranscript(combinedTranscript, fields, 2);
    console.timeEnd("[timer] fewShots");
    log(
      `fewShots: count=${fewShots.length}`,
      fewShots.slice(0, 2).map((fs, i) => ({
        i,
        textPreview: short(fs.text, 160),
        expectedKeys: Object.keys(fs.expected ?? {}),
      }))
    );
  } catch (e: any) {
    err("[fewShots] retrieval failed:", e?.message ?? e);
    // continue without few-shots (fallback)
    fewShots = [];
  }

  // Build Zod schema + prompt
  const schema = z.object(
    Object.fromEntries(
      fields.map((f) => [
        f.id,
        z.object({
          value: zodFieldValueSchema(f),
        }),
      ])
    )
  );

  const prompt = buildPrompt({ fields, oldText, newText, fewShots, lang: lang ?? "en", currentValues });
  const promptInfo = {
    chars: prompt.length,
    approxTokens: approxTokens(prompt),
  };
  log("Prompt size:", promptInfo);
  if (DUMP_FULL_PROMPT) {
    warn("[prompt FULL]\n" + prompt);
  } else {
    log("[prompt PREVIEW]\n" + short(prompt, 2000));
  }

  // Call the model with timing + error details
  let object: unknown;
  try {
    console.time("[timer] generateObject");
    const res = await generateObject({
      model: openai(modelName),
      schema,
      prompt,
    });
    console.timeEnd("[timer] generateObject");
    object = res.object;
    const rawStr = JSON.stringify(object);
    log("Raw LLM output size:", { chars: rawStr.length, approxTokens: approxTokens(rawStr) });
    log("Raw LLM output (preview):", short(rawStr, 1200));
  } catch (e: any) {
    err("[generateObject] failed");
    err("name:", e?.name);
    err("message:", e?.message);
    if (e?.status) err("status:", e.status);
    if (e?.cause) err("cause:", e.cause);
    // Helpful: dump the first 2k chars of the prompt for debugging
    err("[prompt snapshot]\n" + short(prompt, 2000));
    throw e;
  }

  // Build filled map
  const raw = object as Record<string, { value?: unknown | null }>;
  const filled: Record<string, FilledField> = {};
  for (const f of fields) {
    const prev = currentValues?.[f.id];
    const prevVal = prev?.value ?? null;
    const r = raw?.[f.id] ?? {};
    const hasNew = r.value !== undefined;
    const finalVal = hasNew ? normalizeLLMValue(f, r.value) : prevVal;
    const changed = hasNew ? finalVal !== prevVal : false;

    filled[f.id] = {
      value: finalVal ?? null,
      changed,
      previousValue: changed ? prevVal : undefined,
      source: changed ? "ai" : (prev?.source ?? "ai"),
    };

    log(
      `Field "${f.id}" ${changed ? "changed" : "unchanged"}`,
      changed ? { from: short(String(prevVal), 120), to: short(String(finalVal), 120) } : { value: short(String(finalVal), 120) }
    );
  }

  // Verifier pass
  let verifiedFilled: Record<string, FilledField> = filled;
  try {
    console.time("[timer] verifier");
    verifiedFilled = await runVerifier({
      combinedTranscript,
      fields,
      filled,
      lang: lang ?? "en",
    });
    console.timeEnd("[timer] verifier");
  } catch (e: any) {
    err("[verifier] failed:", e?.message ?? e);
    // keep unverified results as fallback
    verifiedFilled = filled;
  }

  // Chat response
  let chatResponse: string | undefined;
  try {
    console.time("[timer] chatResponse");
    const entries = Object.entries(verifiedFilled) as [string, FilledField][];
    chatResponse = await generateChatResponse(combinedTranscript, fields, currentValues, entries);
    console.timeEnd("[timer] chatResponse");
    log("chatResponse (preview):", short(chatResponse, 600));
  } catch (e: any) {
    err("[chatResponse] failed:", e?.message ?? e);
    chatResponse = undefined;
  }

  log("[=== singleLlmAllField END ===]\n");

  return {
    filled: verifiedFilled,
    model: modelName,
    transcript: { old: oldText, new: newText, combined: combinedTranscript },
    chatResponse,
  };
}
