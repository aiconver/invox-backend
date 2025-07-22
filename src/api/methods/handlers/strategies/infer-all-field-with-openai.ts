import { EnhancedTemplateDefinition } from "../../types";
import { buildPrompt } from "../../utils/promptBuilder";

export const inferWithOpenAI = async (
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<Record<string, any>> => {
  // Only supported for specific processing types
  const supportedTypes = [
    "OneModelAllQuestion",
    "MultiModelAllQuestion",
    "HybridFeedback",
  ];
  if (!supportedTypes.includes(template.processingType)) {
    throw new Error(
      `inferWithOpenAI does not support processingType: ${template.processingType}`
    );
  }

  const prompt = buildPrompt(transcript, template);

  const payload = {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: prompt,
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
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("No valid response from OpenAI");

  const cleaned = content
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
