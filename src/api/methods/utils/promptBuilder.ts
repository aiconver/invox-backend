import { ProcessingType } from "@/db/models/enums";
import { EnhancedTemplateDefinition } from "../types";

export const buildPrompt = (
  transcript: string,
  template: EnhancedTemplateDefinition,
  singleFieldKey?: string
): string => {
  const processingType = template.processingType;

  const domainKnowledge = template.domainKnowledge

  // Use new structure format
  const fieldEntries = Object.entries(template.structure ?? {});
  const fieldDescriptions = fieldEntries
    .map(([key, def]) => {
      return `  "${key}": ${def.type}${def.required ? " (REQUIRED)" : ""}${def.description ? " – " + def.description : ""}`;
    })
    .join("\n");

  // Single-field prompt (OneModelOneQuestion / MultiModelOneQuestion)
  if (
    processingType === ProcessingType.OneModelOneQuestion ||
    processingType === ProcessingType.MultiModelOneQuestion
  ) {
    if (!singleFieldKey) {
      throw new Error("singleFieldKey is required for per-field prompt");
    }

    const def = template.structure?.[singleFieldKey];
    if (!def) throw new Error(`Field "${singleFieldKey}" not found in template structure`);

    return `
You are a precise information extractor.

${domainKnowledge && (`Domain Knowledge: ${domainKnowledge} 
So try answer and user terminolgy of that field`)}

Your task is to extract the field "${singleFieldKey}" from the transcript below.
Expected type: ${def.type}${def.required ? " (REQUIRED)" : ""}${def.description ? " – " + def.description : ""}

❗ Instructions:
- Only extract the value if it is explicitly mentioned in the transcript.
- Respond with the raw JSON value (e.g. string, number, boolean).
- If the value is missing, respond with: null

---

📄 Transcript:
"""
${transcript}
"""

✅ Output:
Raw JSON value only, like:
- "John"
- 42
- null
`.trim();
  }

  // All-fields prompt (OneModelAllQuestion, MultiModelAllQuestion, HybridFeedback)
  return `
You are a reliable and precise information extraction system.

${domainKnowledge && (`The Form is about ${domainKnowledge} 
So try answer and user terminolgy of that field`)}

Your task is to extract structured data from the transcript below using the provided field definitions. Output a valid, minified JSON object.

❗ Rules:
- Only include fields if their values are explicitly mentioned.
- Do NOT guess, hallucinate, or infer missing values.
- If a field cannot be confidently extracted, omit it from the output.
- Output must be pure JSON — no formatting or explanation.

---

📄 Transcript:
"""
${transcript}
"""

🧾 Fields to extract:
${fieldDescriptions}

---

✅ Output:
Raw JSON object only.
Example:
{ "field1": "value1", "field2": 42 }
`.trim();
};
