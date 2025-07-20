import { EnhancedTemplateDefinition } from "../types";
import { buildPrompt } from "../utils/promptBuilder";

export const inferWithOpenAI = async (
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<Record<string, any>> => {
  const prompt = buildPrompt(transcript, template);

  const payload = {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `Extract the structured fields from the text below and respond ONLY with a valid JSON object.\n\n${prompt}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

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
    console.error("OpenAI API error:", errorText);
    throw new Error("OpenAI call failed");
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No valid response from OpenAI");

  const cleaned = content.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("⚠️ Failed to parse JSON from OpenAI:", cleaned);
    throw new Error(`Failed to parse JSON: ${err}\nRaw content: ${cleaned}`);
  }
};
