import { EnhancedTemplateDefinition, ExtractionResult } from "../../types";
import { askFieldFromOpenAI } from "./infer-one-field-with-openai";
import { askFieldFromGemini } from "./infer-one-field-with-gemini";

function getMostCommonVote(votes: string[]): string | null {
  const countMap: Record<string, number> = {};

  for (const v of votes) {
    countMap[v] = (countMap[v] || 0) + 1;
  }

  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

export async function inferWithVotingStrategy(
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<Record<string, any>> {
  const filledTemplate: Record<string, any> = {};
  const missingFields: string[] = [];
  const warnings: string[] = [];

  const fieldKeys = Object.keys(template.structure ?? {});

  for (const key of fieldKeys) {
    const def = template.structure[key];
    const votes: string[] = [];

    try {
      const openaiAnswer = await askFieldFromOpenAI(transcript, template, key);
      const geminiAnswer = await askFieldFromGemini(transcript, template, key);

      votes.push(JSON.stringify(openaiAnswer));
      votes.push(JSON.stringify(geminiAnswer));

      const mostCommon = getMostCommonVote(votes);

      if (mostCommon === null || mostCommon === "") {
        missingFields.push(key);
      } else {
        filledTemplate[key] = JSON.parse(mostCommon);
      }
    } catch (err) {
      console.error(`❌ Voting failed for "${key}":`, err);
      missingFields.push(key);
      warnings.push(`Error on field "${key}": ${err instanceof Error ? err.message : err}`);
    }
  }

  return filledTemplate;
}
