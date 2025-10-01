import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { buildPrompt } from "./prompt-builder";
import {
  CurrentFieldValue,
  FilledField,
  FormTemplateField,
} from "@/types/fill-form";

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
  lang: string;
  locale: string;
  timezone: string;
  fewShots?: any[];
  options?: any;
  current?: CurrentFieldValue;
  modelName: string;
}): Promise<[string, FilledField]> {

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
      perFieldDemos: [],
      rules: [
        "Extract from NEW transcript only",
        "For multiple values: return comma-separated string",
        "READ CAREFULLY: Distinguish perpetrators from victims, responders, and news sources",
        "If unsure whether entity is perpetrator vs victim/responder → do NOT include",
        "Empty field is better than wrong extraction"
      ],
      currentValue: current?.value,
    });

    const { object } = await generateObject({
      model: openai(modelName),
      schema: fieldSchema,
      prompt,
      temperature: 0.1, // Lower temperature for more consistent extraction
    });

    // 🚨 CRITICAL: Normalize the value to match gold standard format
    const normalizedValue = normalizeValueForField(object.value, field.type);
    
    const currentVal = current?.value ?? null;
    let finalVal = currentVal;
    let usedProposed = false;
    
    // Only update if not locked and we have a new value
    if (!current?.locked && normalizedValue !== null) {
      finalVal = normalizedValue;
      usedProposed = true;
    }

    const changed = (currentVal ?? null) !== (finalVal ?? null);

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
    console.error(`Field ${field.id} extraction failed:`, error.message);
    
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