import { DomainKnowledge, FewShotExample, Schema } from "../types/public";

export type BuildAllFieldsPromptArgs = {
  transcript: string;
  structure: Schema;
  knowledge?: DomainKnowledge;
  examples?: FewShotExample[];
  todayISO?: string; // e.g., "2025-08-14"
};

function summarizeKnowledge(knowledge?: DomainKnowledge): string {
  if (!knowledge) return "";
  const ctx = knowledge.context ? `Context: ${knowledge.context}` : "";
  const items = (knowledge.items ?? [])
    .slice(0, 4)
    .map((it) => {
      if (it.kind === "rules") return `Rules: ${it.rules.slice(0, 5).join("; ")}`;
      if (it.kind === "glossary") return `Glossary: ${it.terms.slice(0, 5).map(t => `${t.term}=${t.definition}`).join("; ")}`;
      if (it.kind === "faq") return `FAQ: ${it.pairs.slice(0, 3).map(p => `${p.q} → ${p.a}`).join("; ")}`;
      return it.content.slice(0, 400);
    })
    .join("\n");
  return [ctx, items].filter(Boolean).join("\n").trim();
}

function schemaProjection(structure: Schema): string {
  const lines: string[] = [];
  for (const f of structure.fields) {
    const req = f.constraints?.required ? " (REQUIRED)" : "";
    const desc = f.description ? ` – ${f.description}` : "";
    const type = f.type.toUpperCase();
    const constraints: string[] = [];
    if (f.constraints?.pattern) constraints.push(`pattern=${f.constraints.pattern}`);
    if (f.constraints?.enum?.length) constraints.push(`enum=[${f.constraints.enum.join(", ")}]`);
    if (f.constraints?.min !== undefined) constraints.push(`min=${f.constraints.min}`);
    if (f.constraints?.max !== undefined) constraints.push(`max=${f.constraints.max}`);
    const cstr = constraints.length ? ` {${constraints.join("; ")}}` : "";
    lines.push(`"${f.id}": ${type}${req}${desc}${cstr}`);
  }
  return lines.join("\n");
}

function fewShot(examples?: FewShotExample[]): string {
  if (!examples?.length) return "";
  const ex = examples.slice(0, 1)[0]; // keep it short by default
  return `
Example Transcript:
"""
${ex.transcript}
"""

Example Answers (partial allowed):
${JSON.stringify(ex.answers, null, 2)}
`.trim();
}

export function buildPromptAllFields(args: BuildAllFieldsPromptArgs): { system: string; user: string } {
  const { transcript, structure, knowledge, examples, todayISO } = args;

  const system = `
You are a cautious, extractive information-extraction system.
Never guess. If data is missing or ambiguous, return null and set status accordingly.
Always provide a short evidence quote for extracted values (or null if computed).
Return only valid JSON per the requested schema. No explanations outside JSON.
Dates must be ISO 8601 (YYYY-MM-DD). Today is ${todayISO ?? new Date().toISOString().slice(0,10)}.
`.trim();

  const user = `
Task: Extract fields from the transcript according to the schema below.

Schema:
${schemaProjection(structure)}

${knowledge ? `Domain Knowledge:\n${summarizeKnowledge(knowledge)}` : ""}

${examples ? fewShot(examples) : ""}

Transcript:
"""
${transcript}
"""

Output JSON shape:
{
  "<fieldId>": {
    "value": <any or null>,
    "confidence": <number 0..1>,
    "status": "extracted" | "absent" | "conflict",
    "annotation": <string|null>,
    "actionMessage": <string|null>,
    "reason": "info_not_found" | "contradictory_evidence" | "format_mismatch" | "low_confidence" | "not_applicable" | null,
    "evidence": { "quote": <string>, "start": <int>, "end": <int> } | null
  },
  ...
}

Rules:
- Include ALL schema fields in the output.
- If a field is missing or unclear, set value=null, status="absent", reason="info_not_found",
  and provide a short actionMessage asking the user for that value.
- If contradictory values appear, set value=null, status="conflict", reason="contradictory_evidence",
  and craft an actionMessage asking which candidate is correct.
- Provide evidence quote and offsets only for extracted values.
`.trim();

  return { system, user };
}
