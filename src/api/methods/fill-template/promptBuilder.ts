import { EnhancedTemplateDefinition } from './types';

export const buildPrompt = (transcript: string, template: EnhancedTemplateDefinition): string => {
  const fieldDescriptions = Object.entries(template.fields)
    .map(([key, value]) => {
      const def = typeof value === 'string' ? { type: value } : value;
      return `- "${key}": ${def.type}${def.required ? ' (REQUIRED)' : ''}${def.description ? ' – ' + def.description : ''}`;
    })
    .join('\n');

  return `You are an expert information extraction system.

Your task is to extract the following fields from the transcript and output a valid JSON object. Only include fields that can be confidently inferred from the text. Do not hallucinate or guess values. If a field is not present in the transcript, omit it.

---

📄 Transcript:
"""
${transcript}
"""

🧾 Fields to extract:
${fieldDescriptions}

---

✅ Output:
Respond ONLY with a valid JSON object containing the extracted fields. Do not include any explanation, formatting, or commentary.
`;
};
