// src/strategies/utils/verifier.ts
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { FilledField, FormTemplateField } from "@/types/fill-form";

/** Shape returned by the verifier LLM for each field */
export type VerifierScore = {
  confidence: number;          // 0..1
  quote?: string;              // short supporting snippet (<= ~120 chars)
  reason?: string;             // optional brief rationale
};
export type VerifierResult = Record<string, VerifierScore>;

function isDE(lang?: string) {
  return (lang ?? "en").toLowerCase().startsWith("de");
}

function buildVerifierPrompt({
  fields,
  combinedTranscript,
  filled,
  lang,
}: {
  fields: FormTemplateField[];
  combinedTranscript: string;
  filled: Record<string, FilledField>;
  lang: string;
}) {
  const de = isDE(lang);
  const header = de
    ? [
        "Bewerte für jedes Feld, wie gut der ausgefüllte Wert durch das Transkript belegt ist.",
        "Gib eine Vertrauensbewertung zwischen 0 und 1 zurück (0=sehr unsicher, 1=sehr sicher).",
        "Füge wenn möglich ein kurzes Zitat (≤120 Zeichen) hinzu.",
        "Ändere die Werte NICHT, nur bewerten.",
        "Antworte NUR als JSON: { fieldId: { confidence, quote?, reason? } }",
      ].join(" ")
    : [
        "For each field, rate how well the filled value is supported by the transcript.",
        "Return a confidence between 0 and 1 (0=very uncertain, 1=very certain).",
        "Include a short quote (≤120 chars) when possible.",
        "Do NOT change values; only score them.",
        "Answer ONLY as JSON: { fieldId: { confidence, quote?, reason? } }",
      ].join(" ");

  const fieldsCompact = fields.map(f => `${f.id} (${f.label}, type=${f.type})`).join("\n");

  return [
    header,
    "",
    de ? "Felder:" : "Fields:",
    fieldsCompact,
    "",
    de ? "Ausgefüllte Werte:" : "Filled values:",
    JSON.stringify(
      Object.fromEntries(Object.entries(filled).map(([id, v]) => [id, { value: v.value }])),
      null,
      2
    ),
    "",
    de ? "Transkript (vollständig):" : "Transcript (full):",
    combinedTranscript,
  ].join("\n");
}

/** Run the verifier and merge confidence back into the provided `filled` map. */
export async function runVerifier({
  combinedTranscript,
  fields,
  filled,
  lang,
}: {
  combinedTranscript: string;
  fields: FormTemplateField[];
  filled: Record<string, FilledField>;
  lang: string;
}): Promise<Record<string, FilledField>> {
  // zod schema that mirrors { fieldId: { confidence, quote?, reason? } }
  const verifySchema = z.object(
    Object.fromEntries(
      fields.map((f) => [
        f.id,
        z.object({
          confidence: z.number().min(0).max(1),
          quote: z.string().max(240).optional(),
          reason: z.string().max(240).optional(),
        }),
      ])
    )
  );

  const prompt = buildVerifierPrompt({ fields, combinedTranscript, filled, lang });
  console.log("[verify] Prompt:\n", prompt);

  // keep simple & loud logging (no env flags)
  const modelName = process.env.OPENAI_VERIFY_MODEL || "gpt-4.1-mini";
  const t0 = Date.now();
  const { object } = await generateObject({
    model: openai(modelName),
    schema: verifySchema,
    prompt,
  });
  console.log(`[verify] LLM responded in ${Date.now() - t0}ms`);
  console.log("[verify] Raw LLM output:", JSON.stringify(object, null, 2));

  const verified: Record<string, FilledField> = {};
  for (const f of fields) {
    const base = filled[f.id] ?? { value: null, source: "ai" as const };
    const score = (object as VerifierResult | undefined)?.[f.id];

    verified[f.id] = {
      ...base,
      confidence: score?.confidence,
      evidence: {
        ...(base.evidence ?? {}),
        transcriptSnippet: score?.quote || base.evidence?.transcriptSnippet,
      },
    };
  }
  return verified;
}
