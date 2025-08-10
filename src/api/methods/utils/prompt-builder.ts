import { ProcessingType } from "@/db/models/enums";
import { EnhancedTemplateDefinition } from "../types";

export const buildPrompt = (
  transcript: string,
  template: EnhancedTemplateDefinition,
  singleFieldKey?: string,
  today: Date = new Date()  // default to current date if not passed
): string => {
  const { processingType, domainKnowledge, structure = {} } = template;

  const fieldEntries = Object.entries(structure);
  const fieldDescriptions = fieldEntries
    .map(([key, def]) => {
      return `  "${key}": ${def.type}${def.required ? " (REQUIRED)" : ""}${def.description ? " – " + def.description : ""}`;
    })
    .join("\n");

  const formattedToday = today.toISOString().split("T")[0]; // e.g., "2025-08-06"

  const dateInstructions = `
📅 Date Handling Rules:
- Assume that today's date is ${formattedToday}.
- Output all date fields in the format "DD-MM-YYYY".
- Convert relative terms like "yesterday", "today", and "tomorrow" into absolute dates using the reference date above.
`.trim();

  // Per-field extraction
  if (
    processingType === ProcessingType.OneModelOneQuestion ||
    processingType === ProcessingType.MultiModelOneQuestion
  ) {
    if (!singleFieldKey) {
      throw new Error("singleFieldKey is required for per-field prompt");
    }

    const def = structure[singleFieldKey];
    if (!def) {
      throw new Error(`Field "${singleFieldKey}" not found in template structure`);
    }

    return `
You are a domain-aware, high-precision information extractor.

📌 Task:
Extract the value for the field "${singleFieldKey}" from the transcript below.

📋 Field Definition:
- Type: ${def.type}${def.required ? " (REQUIRED)" : ""}
${def.description ? `- Description: ${def.description}` : ""}

${domainKnowledge ? `📚 Domain Context: ${domainKnowledge}. Use domain-specific vocabulary when relevant.` : ""}

❗ Extraction Rules:
- Extract the value **only if it is explicitly mentioned**.
- Do NOT guess, infer, or hallucinate values.
- Output the raw JSON-compatible value (e.g., string, number, boolean).
- If the value is missing or unclear, return: \`null\`.

${dateInstructions}

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
You are a structured data extraction system, specialized in parsing transcripts into structured JSON.

📌 Task:
Extract all explicitly stated values from the transcript below and return a **valid, minified JSON object** using the following schema.

📋 Field Definitions:
${fieldDescriptions}

${domainKnowledge ? `📚 Domain Context: ${domainKnowledge}. Use domain-relevant terms when applicable.` : ""}

❗ Extraction Guidelines:
- Only extract values that are **explicitly present** in the transcript.
- Do NOT guess or infer missing data.
- If a field is not mentioned clearly, **omit it from the output entirely**.
- Output must be **valid, minified JSON** — no comments, extra formatting, or explanations.

${dateInstructions}

📄 Transcript:
"""
${transcript}
"""

✅ Expected Output:
Minified JSON object only. For example:
{ "field1": "value1", "field2": 42 }
`.trim();
};
