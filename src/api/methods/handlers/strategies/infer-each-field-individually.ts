import { EnhancedTemplateDefinition } from "../../types";
import { buildPrompt } from "../../utils/promptBuilder";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

async function askFieldFromOpenAI(
  transcript: string,
  template: EnhancedTemplateDefinition,
  fieldKey: string
): Promise<any> {
  const prompt = buildPrompt(transcript, template, fieldKey);

  const payload = {
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 128,
  };

  console.log(`🔍 Asking OpenAI for field "${fieldKey}" with prompt:\n${prompt}\n`);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ OpenAI error for field "${fieldKey}":`, errorText);
    throw new Error(`OpenAI request failed for "${fieldKey}"`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  console.log(`🔍 Response for field "${fieldKey}":`, content);

  try {
    return JSON.parse(
      content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "")
    );
  } catch (err) {
    console.warn(`⚠️ Failed to parse response for field "${fieldKey}":`, content);
    return null;
  }
}

export async function inferEachFieldIndividually(
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<Record<string, any>> {
  const filledTemplate: Record<string, any> = {};
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (
    !template.structure ||
    typeof template.structure !== "object" ||
    Array.isArray(template.structure)
  ) {
    throw new Error(
      `Invalid template.structure format. Expected an object, but got: ${JSON.stringify(template.structure)}`
    );
  }

  console.log(`🔍 Starting per-field inference for template structure: ${JSON.stringify(template.structure)}`);

  const fieldKeys = Object.keys(template.structure);

  for (const key of fieldKeys) {
    try {
      const value = await askFieldFromOpenAI(transcript, template, key);

      if (value === null || value === undefined || value === "") {
        missingFields.push(key);
      } else {
        filledTemplate[key] = value;
      }
    } catch (err) {
      console.error(`❌ Failed inference for "${key}":`, err);
      warnings.push(`Error on field "${key}": ${err instanceof Error ? err.message : err}`);
      missingFields.push(key);
    }
  }

  console.log("📦 Inference result:", filledTemplate);
  return filledTemplate;
}
