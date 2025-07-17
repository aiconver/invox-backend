import { EnhancedTemplateDefinition } from './types';
import { buildPrompt } from './promptBuilder';

export const inferWithGemini = async (
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<Record<string, any>> => {
  const prompt = buildPrompt(transcript, template);

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) throw new Error('No valid response from Gemini');
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err}`);
  }
};
