import { DomainKnowledge, Field, Schema } from "../types/public";

export type BuildSingleFieldPromptArgs = {
  transcriptChunk: string;
  field: Field;
  knowledge?: DomainKnowledge;
  todayISO?: string;
};

function fieldLine(f: Field): string {
  const req = f.constraints?.required ? " (REQUIRED)" : "";
  const desc = f.description ? ` – ${f.description}` : "";
  const type = f.type.toUpperCase();
  return `"${f.id}": ${type}${req}${desc}`;
}

export function buildPromptSingleField(args: BuildSingleFieldPromptArgs): { system: string; user: string } {
  const { transcriptChunk, field, knowledge, todayISO } = args;
  const system = `
You extract ONE field precisely. Never guess.
If not present or ambiguous, return value=null with an appropriate status and reason.
Provide evidence quote for extracted values.
Dates must be ISO 8601. Today is ${todayISO ?? new Date().toISOString().slice(0,10)}.
Return only valid JSON for that single field.
`.trim();

  const user = `
Field:
${fieldLine(field)}

${knowledge?.context ? `Context: ${knowledge.context}` : ""}

Transcript (relevant chunk):
"""
${transcriptChunk}
"""

Output JSON for "${field.id}":
{
  "value": <any | null>,
  "confidence": <number 0..1>,
  "status": "extracted" | "absent" | "conflict",
  "annotation": <string|null>,
  "actionMessage": <string|null>,
  "reason": "info_not_found" | "contradictory_evidence" | "format_mismatch" | "low_confidence" | "not_applicable" | null,
  "evidence": { "quote": <string>, "start": <int>, "end": <int> } | null
}
`.trim();

  return { system, user };
}
