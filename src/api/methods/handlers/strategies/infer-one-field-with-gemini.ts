import { EnhancedTemplateDefinition } from "../../types";
import { buildPrompt } from "../../utils/prompt-builder";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

export async function askFieldFromGemini(
  transcript: string,
  template: EnhancedTemplateDefinition,
  fieldKey: string
): Promise<any> {
  const prompt = buildPrompt(transcript, template, fieldKey);

  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Gemini error for field "${fieldKey}":`, errorText);
    throw new Error(`Gemini request failed for "${fieldKey}"`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  console.log(`🔍 Gemini Response for "${fieldKey}":`, content);

  try {
    return JSON.parse(
      content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "")
    );
  } catch (err) {
    console.warn(`⚠️ Failed to parse Gemini response for "${fieldKey}":`, content);
    return null;
  }
}


export async function inferEachFieldIndividuallyWithGemini(
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<Record<string, any>> {
  const filledTemplate: Record<string, any> = {};
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!template.structure || typeof template.structure !== "object" || Array.isArray(template.structure)) {
    throw new Error("Invalid template.structure format.");
  }

  const fieldKeys = Object.keys(template.structure);

  for (const key of fieldKeys) {
    try {
      const value = await askFieldFromGemini(transcript, template, key);
      if (value === null || value === undefined || value === "") {
        missingFields.push(key);
      } else {
        filledTemplate[key] = value;
      }
    } catch (err) {
      console.error(`❌ Failed inference for "${key}" with Gemini:`, err);
      warnings.push(`Gemini error for "${key}": ${err instanceof Error ? err.message : err}`);
      missingFields.push(key);
    }
  }

  console.log("📦 Gemini (per-field) inference result:", filledTemplate);
  return filledTemplate;
}
