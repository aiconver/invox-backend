import { CurrentFieldValue, GetFilledTemplateInput, GetFilledTemplateResult, FilledField, FormTemplateField } from "../types/fill-form";
import { generateChatResponse } from "./utils/chatbot-helper";
import { getFewShotsFromTranscript } from "./utils/get-few-shots";

import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";


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
  return Math.ceil((text?.length ?? 0) / 4);
}
function maskSecret(s?: string | null) {
  if (!s) return "(missing)";
  if (s.length <= 8) return "*".repeat(s.length);
  return s.slice(0, 4) + "…" + s.slice(-4);
}



export function buildPrompt({
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
    currentValue: short(currentValue, 100)
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

  // 🚨 GENERIC FIX: Add formatting rules based on field type, not field ID
  const formattingRules = [...rules];
  
  // For textarea fields (which typically contain lists), specify comma-separated format
  if (field.type === "textarea") {
    formattingRules.push(
      de 
        ? `Bei mehreren Werten: Als komma-getrennte Zeichenkette zurückgeben (z.B. "Wert1, Wert2, Wert3"). Nicht als Array.`
        : `For multiple values: Return as comma-separated string (e.g., "value1, value2, value3"). Not as array.`
    );
  }

  // For enum fields, restrict to allowed values
  if (field.type === "enum" && field.options?.length) {
    formattingRules.push(
      de
        ? `Nur einer dieser Werte: ${field.options.join(", ")}`
        : `Only one of these values: ${field.options.join(", ")}`
    );
  }

  const rulesTitle = de ? "Regeln:" : "Rules:";

  const oldLabel = de
    ? "ALTES Transkript (nur Kontext; NICHT daraus extrahieren):"
    : "OLD transcript (context only; do not extract from this):";

  const newLabel = de
    ? "NEUES Transkript (AUSSCHLIESSLICH hieraus extrahieren):"
    : "NEW transcript (extract ONLY from this):";

  // 🚨 GENERIC OUTPUT FORMAT - works for any field type
  const outputFormat = de
    ? `AUSGABEFORMAT: { "value": "string_oder_null", "confidence": zahl_zwischen_0_und_1 }`
    : `OUTPUT FORMAT: { "value": "string_or_null", "confidence": number_between_0_and_1 }`;

  // Add few-shot examples if available
  let fewShotSection = "";
  if (perFieldDemos.length > 0) {
    log(`[prompt-builder] Adding ${perFieldDemos.length} few-shot examples for field: ${field.id}`);
    
    const exampleTitle = de ? "BEISPIELE:" : "EXAMPLES:";
    const examples = perFieldDemos.map((demo, index) => {
      const textLabel = de ? `Text ${index + 1}:` : `Text ${index + 1}:`;
      const expectedLabel = de ? `Erwartet:` : `Expected:`;
      return `${textLabel} ${short(demo.text, 300)}\n${expectedLabel} ${JSON.stringify(demo.expected)}`;
    }).join("\n\n");
    
    fewShotSection = `\n\n${exampleTitle}\n${examples}`;
  }

  // 🚨 GENERIC EXAMPLES - based on field type, not specific fields
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
    ...formattingRules.map(r => `- ${r}`),
    "",
    oldLabel,
    oldText || "(leer)",
    "",
    newLabel,
    newText,
  ].filter(line => line !== "");

  return promptSections.join("\n");
}



function isDE(lang?: string) {
  return (lang ?? "en").toLowerCase().startsWith("de");
}

// 🚨 CRITICAL: Proper value normalization matching gold standard format
function normalizeValueForField(value: any, fieldType: string): any {
  if (value === null || value === undefined) return null;
  
  // For textarea fields (entity lists), ensure comma-separated string format
  if (fieldType === "textarea") {
    if (Array.isArray(value)) {
      // Filter out empty strings and join with comma
      const filtered = value.filter(v => v && String(v).trim() !== "" && String(v).trim() !== "-");
      return filtered.length > 0 ? filtered.join(", ") : null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      // Already a string - just validate it's not empty or "-"
      return (trimmed && trimmed !== "-") ? trimmed : null;
    }
    return null;
  }
  
  // For enum fields, return uppercase string or null
  if (fieldType === "enum") {
    if (typeof value === "string") {
      const trimmed = value.trim().toUpperCase();
      return (trimmed && trimmed !== "-") ? trimmed : null;
    }
    return null;
  }
  
  // For text fields
  if (fieldType === "text") {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return (trimmed && trimmed !== "-") ? trimmed : null;
    }
    return String(value).trim() || null;
  }
  
  // For number fields
  if (fieldType === "number") {
    return typeof value === "number" ? value : null;
  }
  
  // For date fields
  if (fieldType === "date") {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    return null;
  }
  
  return value;
}

// Get field-specific few-shot examples
function getFieldFewShots(fieldId: string, fewShots: any[] = []) {
  return fewShots
    .filter(shot => shot.expected && shot.expected[fieldId] !== undefined)
    .map(shot => ({
      text: shot.text,
      expected: shot.expected[fieldId]
    }))
    .slice(0, 2); // Limit to 2 examples per field
}

export async function runField({
  field,
  oldText,
  newText,
  combinedTranscript,
  templateId,
  lang,
  locale,
  timezone,
  fewShots = [],
  options,
  current,
  modelName,
}: {
  field: FormTemplateField;
  oldText: string;
  newText: string;
  combinedTranscript: string;
  templateId?: string;
  lang: string;
  locale: string;
  timezone: string;
  fewShots?: any[];
  options?: any;
  current?: CurrentFieldValue;
  modelName: string;
}): Promise<[string, FilledField]> {

  const fieldFewShots = getFieldFewShots(field.id, fewShots);
  log(`[${field.id}] Field-specific few-shots:`, fieldFewShots.length);

  // Schema accepts both strings and arrays for flexibility
  const fieldSchema = z.object({
    value: z.union([
      z.string().nullable(),
      z.number().nullable(),
      z.array(z.string()).nullable(),
      z.null()
    ]),
    confidence: z.number().min(0).max(1).optional(),
    evidence: z.object({
      transcriptSnippet: z.string().max(200).optional()
    }).optional(),
  });

  try {
    const de = isDE(lang);

    const prompt = buildPrompt({
      field,
      oldText, 
      newText,
      templateId,
      lang,
      locale,
      timezone,
      descLine: field.description,
      perFieldDemos: fieldFewShots,
      rules: [
        "Extract from NEW transcript only",
        "For multiple values: return comma-separated string",
        "READ CAREFULLY: Distinguish perpetrators from victims, responders, and news sources",
        "If unsure whether entity is perpetrator vs victim/responder → do NOT include",
        "Empty field is better than wrong extraction"
      ],
      currentValue: current?.value,
    });

    const promptInfo = {
      chars: prompt.length,
      approxTokens: approxTokens(prompt),
    };
    log(`[${field.id}] Prompt size:`, promptInfo);
    
    if (DUMP_FULL_PROMPT) {
      warn(`[${field.id} prompt FULL]\n` + prompt);
    } else {
      log(`[${field.id} prompt PREVIEW]\n` + short(prompt, 1500));
    }

    let object: any;
    try {
      console.time(`[timer] generateObject-${field.id}`);
      const res = await generateObject({
        model: openai(modelName),
        schema: fieldSchema,
        prompt,
        temperature: 0.1, // Lower temperature for more consistent extraction
      });
      console.timeEnd(`[timer] generateObject-${field.id}`);
      object = res.object;
      
      const rawStr = JSON.stringify(object);
      log(`[${field.id}] Raw LLM output:`, {
        value: short(object.value, 200),
        confidence: object.confidence,
        size: { chars: rawStr.length, approxTokens: approxTokens(rawStr) }
      });
    } catch (e: any) {
      err(`[${field.id}] generateObject failed:`, e?.message);
      if (e?.status) err("status:", e.status);
      throw e;
    }

    // 🚨 CRITICAL: Normalize the value to match gold standard format
    const normalizedValue = normalizeValueForField(object.value, field.type);
    log(`[${field.id}] Normalized value:`, { 
      raw: short(object.value, 100), 
      normalized: short(normalizedValue, 100) 
    });
    
    const currentVal = current?.value ?? null;
    let finalVal = currentVal;
    let usedProposed = false;
    
    // Only update if not locked and we have a new value
    if (!current?.locked && normalizedValue !== null) {
      finalVal = normalizedValue;
      usedProposed = true;
    }

    const changed = (currentVal ?? null) !== (finalVal ?? null);
    
    log(`[${field.id}] Final decision:`, {
      current: short(currentVal, 100),
      final: short(finalVal, 100),
      changed,
      locked: current?.locked,
      usedProposed
    });

    return [
      field.id,
      {
        value: finalVal,
        confidence: object.confidence,
        changed,
        previousValue: changed ? currentVal : undefined,
        source: usedProposed ? "ai" : (current?.source ?? "ai"),
        evidence: object.evidence || {},
      },
    ];
    
  } catch (error: any) {
    err(`[${field.id}] Field extraction failed:`, error.message);
    
    // Return current value as fallback
    return [
      field.id,
      {
        value: current?.value ?? null,
        changed: false,
        source: current?.source ?? "ai",
      },
    ];
  }
}

export async function singleLlmOneField(input: GetFilledTemplateInput): Promise<GetFilledTemplateResult> {
  const {
    transcript: legacyTranscript,
    fields,
    lang,
    currentValues,
    locale = "en-US",
    timezone = "Europe/Berlin",
    options,
    templateId,
    oldTranscript,
    newTranscript,
    fewShots: providedFewShots, // Allow pre-provided few shots
  } = input as GetFilledTemplateInput & {
    oldTranscript?: string;
    newTranscript?: string;
  };

  const oldText = (oldTranscript ?? "").trim();
  const newText = (newTranscript ?? legacyTranscript ?? "").trim();

  if (!fields?.length) throw new Error("At least one template field is required.");
  if (!newText) throw new Error("Transcript is required.");

  const combinedTranscript = oldText ? `${oldText}\n${newText}` : newText;
  const modelName = process.env.OPENAI_FILL_MODEL || "gpt-4.1";

  log("\n[=== singleLlmOneField START ===]");
  log("env.OPENAI_FILL_MODEL:", modelName);
  log("env.OPENAI_API_KEY present:", maskSecret(process.env.OPENAI_API_KEY));
  log("Lang:", lang ?? "en");
  log("Fields count:", fields.length);
  log("Field IDs:", fields.map(f => f.id));
  log("Current values keys:", Object.keys(currentValues ?? {}));
  log("Old transcript (preview):", short(oldText, 300));
  log("New transcript (preview):", short(newText, 300));
  log("Provided fewShots count:", providedFewShots?.length ?? 0);

  // Retrieve few-shots if not provided
  let fewShots: any[] = providedFewShots ?? [];
  if (!fewShots.length) {
    try {
      console.time("[timer] fewShots");
      fewShots = await getFewShotsFromTranscript(combinedTranscript, fields, 3);
      console.timeEnd("[timer] fewShots");
      log(`Retrieved fewShots: count=${fewShots.length}`);
      if (fewShots.length > 0) {
        log("Few-shot examples preview:", fewShots.slice(0, 2).map((fs, i) => ({
          i,
          textPreview: short(fs.text, 160),
          expectedKeys: Object.keys(fs.expected ?? {}),
        })));
      }
    } catch (e: any) {
      err("[fewShots] retrieval failed:", e?.message ?? e);
      fewShots = [];
    }
  } else {
    log("Using provided few-shots");
  }

  // Process each field with timing and individual logging
  const tasks = fields.map(f => {
    log(`\n[Processing field: ${f.id}]`, { type: f.type, required: f.required });
    return runField({
      field: f,
      oldText,
      newText,
      combinedTranscript,
      lang,
      templateId,
      locale,
      timezone,
      fewShots,
      options,
      current: currentValues?.[f.id] as CurrentFieldValue,
      modelName,
    });
  });

  const entries = await Promise.all(tasks);
  
  // Log results summary
  log("\n[Field Processing Summary]");
  entries.forEach(([fieldId, result]) => {
    log(`- ${fieldId}:`, {
      value: short(String(result.value), 100),
      changed: result.changed,
      source: result.source,
      confidence: result.confidence
    });
  });

  let chatResponse: string | undefined;
  try {
    console.time("[timer] chatResponse");
    chatResponse = await generateChatResponse(combinedTranscript, fields, currentValues, entries);
    console.timeEnd("[timer] chatResponse");
    log("chatResponse (preview):", short(chatResponse, 600));
  } catch (e: any) {
    err("[chatResponse] failed:", e?.message ?? e);
    chatResponse = undefined;
  }

  log("[=== singleLlmOneField END ===]\n");

  return {
    filled: Object.fromEntries(entries),
    model: modelName,
    transcript: { old: oldText, new: newText, combined: combinedTranscript },
    chatResponse,
  };
}