import { EnhancedTemplateDefinition } from './types';

export const buildPrompt = (transcript: string, template: EnhancedTemplateDefinition): string => {
  const fieldDescriptions = Object.entries(template.fields)
    .map(([k, v]) => {
      const def = typeof v === 'string' ? { type: v } : v;
      return `- ${k} (${def.type})${def.required ? ' [REQUIRED]' : ''}${def.description ? ' - ' + def.description : ''}`;
    }).join('\n');

  return `You are an expert AI. Extract information from the following transcript into structured JSON.

Transcript:
"${transcript}"

Fields to extract:
${fieldDescriptions}

Output only valid JSON. Omit fields not present.`;
};
