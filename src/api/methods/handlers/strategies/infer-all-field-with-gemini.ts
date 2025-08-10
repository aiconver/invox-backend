import { EnhancedTemplateDefinition } from "../../types";
import { buildPrompt } from "../../utils/prompt-builder";

export const inferWithGemini = async (
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
      `inferWithGemini does not support processingType: ${template.processingType}`
    );
  }

  const prompt = buildPrompt(transcript, template);
  console.log(prompt)

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Gemini API error:", errorText);
    throw new Error("Gemini call failed");
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!content) {
    console.error("Gemini response missing content:", data);
    throw new Error("No valid content returned from Gemini");
  }

  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("⚠️ Failed to parse JSON from Gemini:", cleaned);
    throw new Error(`Failed to parse JSON: ${err}\nRaw content: ${cleaned}`);
  }
};
