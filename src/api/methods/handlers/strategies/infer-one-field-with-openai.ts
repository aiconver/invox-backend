import OpenAI from "openai";
import { EnhancedTemplateDefinition } from "../../types";
import { buildPrompt } from "../../utils/prompt-builder";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Asks OpenAI to fill a single field using a field-specific prompt.
 */
export async function askFieldFromOpenAI(
  transcript: string,
  template: EnhancedTemplateDefinition,
  fieldKey: string
): Promise<any> {
  const prompt = buildPrompt(transcript, template, fieldKey);

  console.log(`🔍 Asking OpenAI for field "${fieldKey}" with prompt:\n${prompt}\n`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 128,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  console.log(`📥 Response for field "${fieldKey}":\n${content}\n`);

  if (!content) return null;

  try {
    return JSON.parse(
      content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "")
    );
  } catch (err) {
    console.warn(`⚠️ Failed to parse response for field "${fieldKey}":`, content);
    return null;
  }
}

/**
 * Infers each field in a template individually using OpenAI.
 */
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
      `Invalid template.structure format. Expected an object, but got: ${JSON.stringify(
        template.structure
      )}`
    );
  }

  console.log(
    `🧠 Starting per-field inference for fields: ${Object.keys(template.structure).join(", ")}`
  );

  for (const key of Object.keys(template.structure)) {
    try {
      const value = await askFieldFromOpenAI(transcript, template, key);

      if (value === null || value === undefined || value === "") {
        missingFields.push(key);
      } else {
        filledTemplate[key] = value;
      }
    } catch (err) {
      console.error(`❌ Inference failed for "${key}":`, err);
      warnings.push(`Error on field "${key}": ${err instanceof Error ? err.message : err}`);
      missingFields.push(key);
    }
  }

  console.log("✅ Per-field inference complete:", filledTemplate);
  return filledTemplate;
}
