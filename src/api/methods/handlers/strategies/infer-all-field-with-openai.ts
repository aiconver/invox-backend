import OpenAI from "openai";
import { EnhancedTemplateDefinition } from "../../types";
import { buildPrompt } from "../../utils/prompt-builder";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Infers structured output using OpenAI's SDK with GPT-4o.
 */
export const inferWithOpenAI = async (
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<Record<string, any>> => {
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

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
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
