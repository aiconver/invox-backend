// utils/run-field.ts
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { buildPrompt } from "./prompt-builder";
import {
  CurrentFieldValue,
  FilledField,
  FormTemplateField,
} from "@/types/fill-form";

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