import { ProcessingType } from "@/db/models/enums";
import { EnhancedTemplateDefinition } from "../types";

export const buildPrompt = (
  transcript: string,
  template: EnhancedTemplateDefinition,
  singleFieldKey?: string
): string => {
  const { processingType, domainKnowledge, structure = {} } = template;

  const fieldEntries = Object.entries(structure);
  const fieldDescriptions = fieldEntries
    .map(([key, def]) => {
      return `  "${key}": ${def.type}${def.required ? " (REQUIRED)" : ""}${def.description ? " – " + def.description : ""}`;
    })
    .join("\n");

  // Per-field extraction
  if (
    processingType === ProcessingType.OneModelOneQuestion ||
    processingType === ProcessingType.MultiModelOneQuestion
  ) {
    if (!singleFieldKey) {
      throw new Error("singleFieldKey is required for per-field prompt");
    }

    const def = structure[singleFieldKey];
    if (!def) throw new Error(`Field "${singleFieldKey}" not found in template structure`);

    return `
You are a domain-aware, high-precision information extractor.

📌 Task:
Extract the value for the field "${singleFieldKey}" from the transcript below.

📋 Field definition:
- Type: ${def.type}${def.required ? " (REQUIRED)" : ""}
${def.description ? `- Description: ${def.description}` : ""}

${domainKnowledge ? `📚 Domain Context: ${domainKnowledge}. Use domain-specific terms when appropriate.` : ""}

❗ Extraction Rules:
- Extract **only if the value is explicitly stated**.
- Do NOT guess or infer missing data.
- Output the raw JSON-compatible value (e.g., string, number, boolean).
- If the value is missing or not confidently extractable, return: \`null\`.

📄 Transcript:
"""
${transcript}
"""

✅ Expected Output:
Raw JSON value only. For example:
- "John"
- 42
- null
`.trim();
  }

  // Full-form extraction
  return `
You are a structured data extraction system, specialized in domain-specific transcription parsing.

📌 Task:
Extract relevant field values from the transcript below and return a valid, minified JSON object using the following schema.

📋 Field Definitions:
${fieldDescriptions}

${domainKnowledge ? `📚 Domain Context: ${domainKnowledge}. Use domain-relevant vocabulary where applicable.` : ""}

❗ Extraction Guidelines:
- Only extract values that are **explicitly mentioned**.
- Do NOT guess, infer, or hallucinate any data.
- If a field is not clearly present, **omit it entirely** from the output.
- Output must be **valid JSON**. No comments, formatting, or explanations.

📄 Transcript:
"""
${transcript}
"""

✅ Expected Output:
Minified JSON object only. For example:
{ "field1": "value1", "field2": 42 }
`.trim();
};
