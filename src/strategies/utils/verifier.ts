// src/strategies/utils/verifier.ts
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { FilledField, FormTemplateField } from "@/types/fill-form";

// src/strategies/utils/verifier.ts
type ReasonType = "CONTRADICTED";

export type VerifierReason = {
  type: ReasonType;
  message: string;
};

export type VerifierScore = {
  confidence: number;        // 0..1 support strength (even when contradicted)
  quote?: string;            // ≤120 chars, best fragment showing the contradiction/support
  contradicted: boolean;     // <-- explicit signal
  reason?: VerifierReason;   // present iff contradicted === true
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
      "Bewerte für jedes Feld, wie gut der ausgefüllte Wert durch das Transkript BELEGT ist (confidence 0..1).",
      "Markiere 'contradicted=true' NUR wenn der Transkriptinhalt dem Wert widerspricht.",
      "Typische Widersprüche: explizite Negation, gegenteiliger Wert (Zahl/Datum), Rollenvertauschung (Täter/Opfer), gegenseitig ausschließende Kategorien, Ort/Zeit-Konflikt.",
      "Wenn contradicted=true, gib reason { type: CONTRADICTED, message } und ein kurzes Zitat (≤120 Zeichen).",
      "Wenn KEIN Widerspruch: contradicted=false und KEIN reason.",
      "Ändere die Werte NICHT, nur bewerten.",
      "Antworte NUR als JSON: { fieldId: { confidence, quote?, contradicted, reason? } }",
    ].join(" ")
  : [
      "For each field, rate how well the filled value is SUPPORTED by the transcript (confidence 0..1).",
      "Set 'contradicted=true' ONLY if the transcript contradicts the value.",
      "Typical contradictions: explicit negation, opposite number/date, role reversal (perpetrator/victim), mutually exclusive enums, location/date conflict.",
      "If contradicted=true, include reason { type: CONTRADICTED, message } and a short quote (≤120 chars).",
      "If NO contradiction: contradicted=false and NO reason.",
      "Do NOT change values; only score.",
      "Answer ONLY as JSON: { fieldId: { confidence, quote?, contradicted, reason? } }",
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
 const reasonEnum = z.enum(["CONTRADICTED"] as const);

const verifySchema = z.object(
  Object.fromEntries(
    fields.map((f) => [
      f.id,
      z.object({
        confidence: z.number().min(0).max(1),
        quote: z.string().max(240).default(""),
        contradicted: z.boolean().default(false),
        reason: z
          .object({
            type: reasonEnum,
            message: z.string().max(240),
          })
          .optional(),
      }),
    ])
  )
);

  const prompt = buildVerifierPrompt({ fields, combinedTranscript, filled, lang });
  console.log("[verify] Prompt:\n", prompt);

  // keep simple & loud logging (no env flags)
  const modelName = process.env.OPENAI_VERIFY_MODEL || "gpt-4o-mini";
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
        transcriptSnippet: score?.quote?.trim() || base.evidence?.transcriptSnippet,
      },
      reason: score?.contradicted ? score?.reason : undefined,
    };
  }
  return verified;
}
