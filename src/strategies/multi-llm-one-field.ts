// multi-llm-one-field.ts
// Per-field ensemble: GPT + Gemini → Per-field verifier → final value
// Evidence/snippets are NOT requested, only { value, confidence }.

import {
  CurrentFieldValue,
  FilledField,
  FormTemplateField,
  GetFilledTemplateInput,
  GetFilledTemplateResult,
} from "@/types/fill-form";

import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { getFewShotsFromTranscript } from "./utils/get-few-shots";

// ─────────────────────────────────────────────────────────────────────────────
// Config & logging

const DEBUG = process.env.DEBUG_FILL !== "0";
const DUMP_FULL_PROMPT = process.env.DUMP_FULL_PROMPT === "1";

function log(...a: any[]) { if (DEBUG) console.log(...a); }
function warn(...a: any[]) { if (DEBUG) console.warn(...a); }
function err(...a: any[]) { if (DEBUG) console.error(...a); }
function short(v: unknown, m = 400) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return !s ? "" : (s.length > m ? s.slice(0, m) + ` … [${s.length} chars]` : s);
}
function approxTokens(t: string) { return Math.ceil((t?.length ?? 0) / 4); }
function maskSecret(s?: string | null) {
  if (!s) return "(missing)";
  if (s.length <= 8) return "*".repeat(s.length);
  return s.slice(0, 4) + "…" + s.slice(-4);
}

// Multi-value fields in MUC-4
const MULTI_VALUE_FIELD_IDS = new Set(["PerpInd", "PerpOrg", "Target", "Victim", "Weapon"]);

function isDE(lang?: string) {
  return (lang ?? "en").toLowerCase().startsWith("de");
}

// ─────────────────────────────────────────────────────────────────────────────
// Value normalization

function normalizeValueForField(value: any, fieldType: string): any {
  if (value === null || value === undefined) return null;

  if (fieldType === "textarea") {
    if (Array.isArray(value)) {
      const filtered = value
        .map((v) => (v == null ? "" : String(v)))
        .map((v) => v.trim())
        .filter((v) => v && v !== "-");
      return filtered.length > 0 ? filtered.join(", ") : null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed && trimmed !== "-" ? trimmed : null;
    }
    return null;
  }

  if (fieldType === "enum") {
    if (typeof value === "string") {
      const trimmed = value.trim().toUpperCase();
      return trimmed && trimmed !== "-" ? trimmed : null;
    }
    return null;
  }

  if (fieldType === "text") {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed && trimmed !== "-" ? trimmed : null;
    }
    return String(value).trim() || null;
  }

  if (fieldType === "number") {
    return typeof value === "number" ? value : null;
  }

  if (fieldType === "date") {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return null;
  }

  return value;
}

function splitCsv(s?: string | null): string[] {
  if (!s) return [];
  return String(s).split(",").map((x) => x.trim()).filter(Boolean);
}
function uniqueKeepOrder(arr: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const x of arr) { if (!seen.has(x)) { seen.add(x); out.push(x); } }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Few-shots per field

function getFieldFewShots(fieldId: string, fewShots: any[] = []) {
  return fewShots
    .filter((shot) => shot.expected && shot.expected[fieldId] !== undefined)
    .map((shot) => ({
      text: shot.text,
      expected: shot.expected[fieldId],
    }))
    .slice(0, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder (per field)

function buildFieldPrompt({
  field,
  oldText,
  newText,
  templateId,
  lang,
  locale,
  timezone,
  descLine,
  perFieldDemos = [],
  rules,
  currentValue,
}: {
  field: FormTemplateField;
  oldText: string;
  newText: string;
  templateId?: string;
  lang: string;
  locale: string;
  timezone: string;
  descLine?: string | null;
  perFieldDemos: any[];
  rules: string[];
  currentValue?: any;
}) {
  const de = isDE(lang);

  log(`[prompt-builder] Building prompt for field: ${field.id}`, {
    perFieldDemosCount: perFieldDemos.length,
    currentValue: short(currentValue, 100),
  });

  const headerLine = de
    ? `Vorlagen-ID: ${templateId ?? "(nicht angegeben)"} | Gebietsschema: ${locale} | Zeitzone: ${timezone}`
    : `Template ID: ${templateId ?? "(unspecified)"} | Locale: ${locale} | Timezone: ${timezone}`;

  const fieldLine = de
    ? `Feld: ${field.label} (id: ${field.id}, type: ${field.type}${field.required ? ", erforderlich" : ""})`
    : `Field: ${field.label} (id: ${field.id}, type: ${field.type}${field.required ? ", required" : ""})`;

  const currentLine = de
    ? `Aktueller Wert: ${currentValue !== undefined ? JSON.stringify(currentValue) : "null"}`
    : `Current value: ${currentValue !== undefined ? JSON.stringify(currentValue) : "null"}`;

  const formattingRules = [...rules];

  if (field.type === "textarea") {
    formattingRules.push(
      de
        ? `Bei mehreren Werten: Als komma-getrennte Zeichenkette zurückgeben (z.B. "Wert1, Wert2, Wert3"). Nicht als Array.`
        : `For multiple values: Return as comma-separated string (e.g., "value1, value2, value3"). Not as array.`
    );
  }

  if (field.type === "enum" && field.options?.length) {
    formattingRules.push(
      de ? `Nur einer dieser Werte: ${field.options.join(", ")}` : `Only one of these values: ${field.options.join(", ")}`
    );
  }

  const rulesTitle = de ? "Regeln:" : "Rules:";
  const oldLabel = de
    ? "ALTES Transkript (nur Kontext; NICHT daraus extrahieren):"
    : "OLD transcript (context only; do not extract from this):";
  const newLabel = de ? "NEUES Transkript (AUSSCHLIESSLICH hieraus extrahieren):" : "NEW transcript (extract ONLY from this):";

  // IMPORTANT: No 'evidence' in output format
  const outputFormat = de
    ? `AUSGABEFORMAT: { "value": "string_oder_null", "confidence": zahl_zwischen_0_und_1 }`
    : `OUTPUT FORMAT: { "value": "string_or_null", "confidence": number_between_0_and_1 }`;

  // Per-field few-shot examples
  let fewShotSection = "";
  if (perFieldDemos.length > 0) {
    const exampleTitle = de ? "BEISPIELE:" : "EXAMPLES:";
    const examples = perFieldDemos
      .map((demo: any, index: number) => {
        const textLabel = de ? `Text ${index + 1}:` : `Text ${index + 1}:`;
        const expectedLabel = de ? `Erwartet:` : `Expected:`;
        return `${textLabel} ${short(demo.text, 300)}\n${expectedLabel} ${JSON.stringify(demo.expected)}`;
      })
      .join("\n\n");
    fewShotSection = `\n\n${exampleTitle}\n${examples}`;
  }

  // Generic examples by field type
  let genericExamples = "";
  if (field.type === "textarea") {
    genericExamples = de
      ? `BEISPIELE:\n- Mehrere Werte: {"value": "Wert1, Wert2, Wert3", "confidence": 0.9}\n- Keine Werte: {"value": null, "confidence": 0.8}\n- Ein Wert: {"value": "Wert1", "confidence": 0.95}`
      : `EXAMPLES:\n- Multiple values: {"value": "value1, value2, value3", "confidence": 0.9}\n- No values: {"value": null, "confidence": 0.8}\n- Single value: {"value": "value1", "confidence": 0.95}`;
  } else if (field.type === "enum") {
    genericExamples = de
      ? `BEISPIELE:\n- Gültiger Wert: {"value": "${field.options?.[0] || "OPTION"}", "confidence": 0.9}\n- Kein Wert: {"value": null, "confidence": 0.8}`
      : `EXAMPLES:\n- Valid value: {"value": "${field.options?.[0] || "OPTION"}", "confidence": 0.9}\n- No value: {"value": null, "confidence": 0.8}`;
  } else {
    genericExamples = de
      ? `BEISPIELE:\n- Mit Wert: {"value": "Beispielwert", "confidence": 0.9}\n- Ohne Wert: {"value": null, "confidence": 0.8}`
      : `EXAMPLES:\n- With value: {"value": "example value", "confidence": 0.9}\n- Without value: {"value": null, "confidence": 0.8}`;
  }

  const promptSections = [
    headerLine,
    outputFormat,
    genericExamples,
    fewShotSection,
    "",
    fieldLine,
    currentLine,
    "",
    ...(descLine ? [descLine, ""] : []),
    "",
    rulesTitle,
    ...formattingRules.map((r) => `- ${r}`),
    "",
    oldLabel,
    oldText || "(leer)",
    "",
    newLabel,
    newText,
  ].filter((line) => line !== "");

  return promptSections.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-field schemas

// Generation (per model, per field): no evidence
const fieldGenSchema = z.object({
  value: z.union([z.string(), z.number(), z.array(z.string())]).nullable(),
  confidence: z.number().min(0).max(1).optional(),
});

// Verifier (per field) → decision only (we merge locally)
const verifierOutSchema = z.object({
  decision: z.enum(["gpt", "gemini", "merge", "keep_current"]),
  reason: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-field verifier

async function runVerifierForField({
  newText,
  field,
  current,
  gptCandidate,
  gemCandidate,
  verifierModel,
}: {
  newText: string;
  field: FormTemplateField;
  current?: CurrentFieldValue;
  gptCandidate: { value: any; confidence?: number };
  gemCandidate: { value: any; confidence?: number };
  verifierModel: string;
}) {
  const de = isDE();

  const rules = [
    de
      ? "Wähle GENAU EINE Option: 'gpt', 'gemini', 'merge', 'keep_current'."
      : "Choose EXACTLY ONE: 'gpt', 'gemini', 'merge', 'keep_current'.",
    de
      ? "locked=true NIE überschreiben."
      : "Never overwrite locked=true.",
    de
      ? "Bevorzuge Kandidaten, die mit dem NEUEN Transkript konsistent sind."
      : "Prefer the candidate that is consistent with the NEW transcript.",
    de
      ? "Bei gleicher Konsistenz → höheren Confidence-Wert bevorzugen."
      : "If both are consistent, prefer the higher-confidence candidate.",
    de
      ? "Wenn beide leer/unsicher → 'keep_current'."
      : "If both are empty/uncertain → 'keep_current'.",
    de
      ? "Merge NUR für Mehrfach-Felder (textarea). Für 'enum'/'text' KEIN Merge."
      : "Use 'merge' ONLY for multi-value textarea fields. For 'enum'/'text' NO merge.",
  ];

  const fieldSummary = {
    id: field.id,
    label: field.label,
    type: field.type,
    required: !!field.required,
    options: field.type === "enum" ? field.options ?? [] : [],
    locked: !!current?.locked,
    current: current?.value ?? null,
    gpt: { value: gptCandidate.value, confidence: gptCandidate.confidence },
    gemini: { value: gemCandidate.value, confidence: gemCandidate.confidence },
    guidelines: field.description ?? "",
  };

  const prompt = [
    de
      ? "Rolle: Strenger Verifizierer für EIN Feld."
      : "Role: You are a strict verifier for ONE field.",
    "",
    ...rules.map((r) => `- ${r}`),
    "",
    "FIELD:",
    JSON.stringify(fieldSummary, null, 2),
    "",
    de ? "NEUES TRANSKRIPT (Kontext):" : "NEW TRANSCRIPT (context):",
    newText.slice(0, 6000),
    "",
    de
      ? `Gib NUR JSON zurück: ${JSON.stringify({ decision: "..." })}`
      : `Return JSON ONLY: ${JSON.stringify({ decision: "..." })}`,
  ].join("\n");

  if (DUMP_FULL_PROMPT) warn(`[verifier ${field.id} FULL]\n` + prompt);
  else log(`[verifier ${field.id} PREVIEW]\n` + short(prompt, 1800));

  const res = await generateObject({
    model: openai(verifierModel),
    schema: verifierOutSchema,
    prompt,
    temperature: 0.2,
  });

  return res.object as { decision: "gpt" | "gemini" | "merge" | "keep_current"; reason?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-field runner: GPT + Gemini → verify → final value

async function runOneFieldWithEnsemble({
  field,
  oldText,
  newText,
  lang,
  templateId,
  locale,
  timezone,
  fewShots,
  current,
  gptModel,
  geminiModel,
  verifierModel,
}: {
  field: FormTemplateField;
  oldText: string;
  newText: string;
  lang: string;
  templateId?: string;
  locale: string;
  timezone: string;
  fewShots: any[];
  current?: CurrentFieldValue;
  gptModel: string;
  geminiModel: string;
  verifierModel: string;
}): Promise<[string, FilledField]> {
  const perFieldDemos = getFieldFewShots(field.id, fewShots);
  log(`[${field.id}] few-shots:`, perFieldDemos.length);

  const prompt = buildFieldPrompt({
    field,
    oldText,
    newText,
    templateId,
    lang,
    locale,
    timezone,
    descLine: field.description ?? undefined,
    perFieldDemos,
    rules: [
      "Extract from NEW transcript only",
      "For multiple values: return comma-separated string (not an array)",
      "Distinguish perpetrators from victims/responders/sources",
      "If unsure: leave empty (null)",
    ],
    currentValue: current?.value,
  });

  const pInfo = { chars: prompt.length, approxTokens: approxTokens(prompt) };
  log(`[${field.id}] Prompt size:`, pInfo);
  if (DUMP_FULL_PROMPT) warn(`[${field.id} prompt FULL]\n${prompt}`);
  else log(`[${field.id} prompt PREVIEW]\n${short(prompt, 1500)}`);

  // Unique timer tags to quiet warnings
  const tag = `${field.id}-${Date.now().toString(36)}`;

  // GPT call
  let gptObj: any = {};
  try {
    console.time(`[timer] ${tag} GPT`);
    const gptRes = await generateObject({ model: openai(gptModel), schema: fieldGenSchema, prompt, temperature: 0.1 });
    console.timeEnd(`[timer] ${tag} GPT`);
    gptObj = gptRes.object;
  } catch (e: any) {
    err(`[${field.id}] GPT failed:`, e?.message ?? e);
  }

  // Gemini call
  let gemObj: any = {};
  try {
    console.time(`[timer] ${tag} Gemini`);
    const gemRes = await generateObject({ model: google(geminiModel), schema: fieldGenSchema, prompt, temperature: 0.1 });
    console.timeEnd(`[timer] ${tag} Gemini`);
    gemObj = gemRes.object;
  } catch (e: any) {
    err(`[${field.id}] Gemini failed:`, e?.message ?? e);
  }

  // Normalize candidates
  const vG = normalizeValueForField(gptObj?.value ?? null, field.type);
  const cG = typeof gptObj?.confidence === "number" ? gptObj.confidence : undefined;

  const vM = normalizeValueForField(gemObj?.value ?? null, field.type);
  const cM = typeof gemObj?.confidence === "number" ? gemObj.confidence : undefined;

  if (DEBUG) {
    log(`[${field.id}] GPT raw:`, short(JSON.stringify(gptObj), 300));
    log(`[${field.id}] Gemini raw:`, short(JSON.stringify(gemObj), 300));
  }

  // Verify
  let decision: "gpt" | "gemini" | "merge" | "keep_current" = "keep_current";
  try {
    const dec = await runVerifierForField({
      newText,
      field,
      current,
      gptCandidate: { value: vG, confidence: cG },
      gemCandidate: { value: vM, confidence: cM },
      verifierModel,
    });
    decision = dec.decision;
  } catch (e: any) {
    err(`[${field.id}] verifier failed:`, e?.message ?? e);
    // fallback heuristic
    if (vG != null || vM != null) {
      decision = (cG ?? 0) >= (cM ?? 0) ? "gpt" : "gemini";
    }
  }

  // Apply decision
  const prevVal = current?.value ?? null;
  const locked = !!current?.locked;

  let finalVal: any = prevVal;
  if (!locked) {
    if (decision === "gpt") finalVal = vG ?? prevVal;
    else if (decision === "gemini") finalVal = vM ?? prevVal;
    else if (decision === "merge" && MULTI_VALUE_FIELD_IDS.has(field.id)) {
      const merged = uniqueKeepOrder([...splitCsv(String(vG ?? "")), ...splitCsv(String(vM ?? ""))]);
      finalVal = merged.join(", ") || prevVal;
    } else if (decision === "keep_current") {
      finalVal = prevVal;
    }
  }

  const changed = finalVal !== prevVal;

  log(
    `[${field.id}] Decision: ${decision} | changed=${changed} | final=${short(String(finalVal), 140)}`
  );

  // Confidence: keep the higher of the used candidates (telemetry only)
  let confidence: number | undefined = undefined;
  if (decision === "gpt") confidence = cG;
  else if (decision === "gemini") confidence = cM;
  else if (decision === "merge") confidence = Math.max(cG ?? 0, cM ?? 0);

  const out: FilledField = {
    value: finalVal ?? null,
    changed,
    previousValue: changed ? prevVal : undefined,
    source: changed ? "ai" : (current?.source ?? "ai"),
    // confidence is optional in FilledField; keep if your type includes it
    ...(confidence !== undefined ? { confidence } : {}),
  } as FilledField;

  return [field.id, out];
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional very small chat response (stub). Replace with your own if desired.

async function generateChatResponse(
  _combinedTranscript: string,
  _fields: FormTemplateField[],
  _currentValues: Record<string, CurrentFieldValue> | undefined,
  entries: [string, FilledField][]
): Promise<string> {
  const changed = entries.filter(([, v]) => v.changed);
  return changed.length
    ? `Updated ${changed.length} field(s): ${changed.map(([k]) => k).join(", ")}`
    : "No changes applied.";
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Public strategy: MULTI LLM, ONE FIELD
 * - For each field: call GPT + Gemini → per-field verifier → final value.
 * - No transcript evidence returned; only value (+ optional confidence).
 */
export async function multiLlmOneField(
  input: GetFilledTemplateInput
): Promise<GetFilledTemplateResult> {
  const {
    transcript: legacyTranscript,
    fields,
    lang,
    currentValues,
    locale = "en-US",
    timezone = "Europe/Berlin",
    templateId,
    oldTranscript,
    newTranscript,
  } = input as GetFilledTemplateInput & { oldTranscript?: string; newTranscript?: string };

  const gptModel = process.env.OPENAI_FILL_MODEL_GPT || "gpt-5-mini";
  const geminiModel = process.env.OPENAI_FILL_MODEL_GEMINI || "gemini-2.5-flash";
  const verifierModel = process.env.OPENAI_VERIFIER_MODEL || "gpt-4.1-mini";

  const oldText = (oldTranscript ?? "").trim();
  const newText = (newTranscript ?? legacyTranscript ?? "").trim();
  const combinedTranscript = oldText ? `${oldText}\n${newText}` : newText;

  log("\n[=== multiLlmOneField START ===]");
  log("env.OPENAI_FILL_MODEL_GPT:", gptModel);
  log("env.OPENAI_FILL_MODEL_GEMINI:", geminiModel);
  log("env.OPENAI_VERIFIER_MODEL:", verifierModel);
  log("env.OPENAI_API_KEY present:", maskSecret(process.env.OPENAI_API_KEY));
  log("Lang:", lang ?? "en");
  log("Fields:", fields.map((f) => ({ id: f.id, type: f.type, required: !!f.required })));
  log("Current values keys:", Object.keys(currentValues ?? {}));
  log("Old transcript (preview):", short(oldText, 300));
  log("New transcript (preview):", short(newText, 300));

  if (!fields?.length) throw new Error("At least one field is required.");
  if (!newText) throw new Error("Transcript is required.");

  // Few-shots once per document (reused for each field)
  let fewShots: any[] = [];
  try {
    console.time("[timer] fewShots");
    fewShots = await getFewShotsFromTranscript(combinedTranscript, fields, 3);
    console.timeEnd("[timer] fewShots");
    log("fewShots count:", fewShots.length);
  } catch (e: any) {
    err("[fewShots] retrieval failed:", e?.message ?? e);
    fewShots = [];
  }

  // Process fields sequentially (safer for rate limits)
  const results: [string, FilledField][] = [];
  for (const f of fields) {
    const entry = await runOneFieldWithEnsemble({
      field: f,
      oldText,
      newText,
      lang: lang ?? "en",
      templateId,
      locale,
      timezone,
      fewShots,
      current: currentValues?.[f.id],
      gptModel,
      geminiModel,
      verifierModel,
    });
    results.push(entry);
  }

  // Optional chat summary
  let chatResponse: string | undefined;
  try {
    console.time("[timer] chatResponse");
    chatResponse = await generateChatResponse(combinedTranscript, fields, currentValues, results);
    console.timeEnd("[timer] chatResponse");
    log("chatResponse (preview):", short(chatResponse, 600));
  } catch (e: any) {
    err("[chatResponse] failed:", e?.message ?? e);
    chatResponse = undefined;
  }

  log("[=== multiLlmOneField END ===]\n");

  return {
    filled: Object.fromEntries(results),
    model: `ensemble-per-field:${gptModel}+${geminiModel}`,
    transcript: { old: oldText, new: newText, combined: combinedTranscript },
    chatResponse,
  };
}
