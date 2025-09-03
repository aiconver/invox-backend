import { FieldResult } from "../types/public";

export type BuildReconcilePromptArgs = {
  fieldId: string;
  candidates: Array<{ value: unknown; evidence?: { quote: string } | null }>;
  rules?: string[]; // e.g., "Prefer header over footer", "Latest date wins"
};

export function buildPromptReconcile(args: BuildReconcilePromptArgs): { system: string; user: string } {
  const { fieldId, candidates, rules } = args;

  const system = `
You are a resolver that chooses the best candidate for a field using provided rules and evidence.
If unable to decide, abstain with value=null and reason="contradictory_evidence" and provide a short actionMessage.
Return only JSON.
`.trim();

  const user = `
Field: ${fieldId}

Rules:
${(rules ?? []).map((r, i) => `- ${r}`).join("\n")}

Candidates:
${JSON.stringify(candidates, null, 2)}

Output JSON:
{
  "value": <any | null>,
  "confidence": <number 0..1>,
  "status": "extracted" | "conflict",
  "annotation": <string|null>,
  "actionMessage": <string|null>,
  "reason": "contradictory_evidence" | "low_confidence" | null,
  "evidence": { "quote": <string>, "start": <int>, "end": <int> } | null
}
`.trim();

  return { system, user };
}
