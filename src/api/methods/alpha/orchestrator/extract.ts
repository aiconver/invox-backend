import {
  ExtractionInput,
  ExtractionResult,
  FieldResult,
  FieldStatus,
  ProcessingType,
  Schema,
  Field,
} from "../types/public";
import { inferAllFieldsWithOpenAI, inferSingleFieldWithOpenAI } from "../providers/openai";
import { AllFieldsResultSchema, FieldResultSchema } from "../validation/schemas";

type OrchestratorOptions = {
  maxAttempts?: number;              // total attempts for all-fields pass
  timeoutMs?: number;                // end-to-end guard per provider call
  todayISO?: string;                 // e.g., "2025-08-14"
  model?: string;                    // e.g., "gpt-4o"
  minConfidenceDefault?: number;     // fallback threshold when field-specific missing
  maxEscalationsPerField?: number;   // how many per-field escalations
};

const DEFAULTS: Required<OrchestratorOptions> = {
  maxAttempts: 2,
  timeoutMs: 20000,
  todayISO: new Date().toISOString().slice(0, 10),
  model: "gpt-4o",
  minConfidenceDefault: 0.7,
  maxEscalationsPerField: 1,
};

// --- Helpers --------------------------------------------------------------

function nowMs() { return performance.now ? performance.now() : Date.now(); }

function calcCompleteness(filled: Record<string, FieldResult>, schema: Schema): number {
  const requiredIds = schema.fields.filter(f => f.constraints?.required).map(f => f.id);
  if (requiredIds.length === 0) return 1;
  const ok = requiredIds.filter(id => filled[id]?.status === "extracted");
  return ok.length / requiredIds.length;
}

function ensureAllFieldsPresent(
  partial: Record<string, FieldResult>,
  schema: Schema
): Record<string, FieldResult> {
  const out: Record<string, FieldResult> = { ...partial };
  for (const f of schema.fields) {
    if (!out[f.id]) {
      out[f.id] = {
        value: null,
        confidence: 0,
        status: "absent",
        annotation: "No evidence found in initial pass.",
        actionMessage: `Please provide ${f.label ?? f.id}.`,
        reason: "info_not_found",
        evidence: null,
      };
    }
  }
  return out;
}

function needsEscalation(
  fr: FieldResult,
  field: Field,
  minConfidenceDefault: number
): boolean {
  if (fr.status === "extracted") {
    const minC = field.constraints?.confidenceThreshold ?? minConfidenceDefault;
    return fr.confidence < minC;
  }
  // absent or conflict — escalate if required field or high priority
  const required = !!field.constraints?.required;
  const highPriority = field.priority === "high";
  return required || highPriority;
}

function defaultActionMessage(field: Field, reason: FieldResult["reason"]): string {
  if (reason === "contradictory_evidence") {
    return `We found conflicting values for ${field.label ?? field.id}. Which is correct?`;
  }
  return `Please provide ${field.label ?? field.id}.`;
}

function clampConfidence(x: number) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// For now, no fancy chunking—return whole transcript.
// You can later plug in semantic chunking here.
function selectRelevantChunk(transcript: string): string {
  return transcript;
}


// --- Main orchestrator ----------------------------------------------------

export async function extractStructuredData(
  input: ExtractionInput,
  opts: OrchestratorOptions = {}
): Promise<ExtractionResult> {
  const o = { ...DEFAULTS, ...opts };
  const start = nowMs();

  // Normalize transcript
  const transcript = typeof input.transcript === "string" ? input.transcript : input.transcript.text;
  if (!transcript?.trim()) {
    throw new Error("Transcript is required");
  }
  const structure = input.structure;
  if (!structure?.fields?.length) {
    throw new Error("structure.fields is required");
  }

  const processingType = input.processingType ?? ProcessingType.OneModelAllQuestion;

  // --- Stage 2: all-fields pass
  let timings: Record<string, number> = {};
  let t0 = nowMs();
  const initial = await inferAllFieldsWithOpenAI({
    transcript,
    structure,
    knowledge: input.knowledge,
    examples: input.examples,
    todayISO: o.todayISO,
    model: o.model,
    timeoutMs: o.timeoutMs,
    temperature: 0,
  });
  timings.initialExtractionMs = nowMs() - t0;

  // Validate model JSON shape again (defense in depth)
  const validated = AllFieldsResultSchema.parse(initial);

  // Ensure all fields present in object (fill nulls for missing)
  let filled: Record<string, FieldResult> = ensureAllFieldsPresent(validated, structure);

  // Clamp confidence & fill defaults where needed
  for (const f of structure.fields) {
    const r = filled[f.id];
    r.confidence = clampConfidence(r.confidence ?? 0);
    if (!r.actionMessage && (r.status === "absent" || r.status === "conflict")) {
      r.actionMessage = defaultActionMessage(f, r.reason ?? "info_not_found");
    }
    if (!r.annotation) {
      r.annotation = r.status === "extracted" ? "Extracted from transcript." : "No reliable evidence found.";
    }
  }

  // --- Stage 3: validation/gating (simple policy here; you can expand)
  // If required fields are missing or low-confidence, escalate per field once.
  let escalations = 0;
  t0 = nowMs();
  for (const f of structure.fields) {
    const current = filled[f.id];
    if (escalations >= o.maxEscalationsPerField * structure.fields.length) break; // global safety

    if (!needsEscalation(current, f, o.minConfidenceDefault)) continue;

    if (o.maxEscalationsPerField <= 0) continue;

    let timesForField = 0;
    while (timesForField < o.maxEscalationsPerField) {
      timesForField++;
      escalations++;

      const chunk = selectRelevantChunk(transcript);
      try {
        const fieldRes = await inferSingleFieldWithOpenAI({
          transcriptChunk: chunk,
          field: f,
          knowledge: input.knowledge,
          todayISO: o.todayISO,
          model: o.model,
          timeoutMs: o.timeoutMs,
          temperature: 0,
        });

        const parsed = FieldResultSchema.parse(fieldRes);
        // Merge if improved:
        const better =
          (parsed.status === "extracted" && parsed.confidence > (current.confidence ?? 0)) ||
          (current.status !== "extracted" && parsed.status !== "absent");

        if (better) {
          filled[f.id] = {
            ...parsed,
            confidence: clampConfidence(parsed.confidence ?? 0),
            annotation: parsed.annotation ?? (parsed.status === "extracted" ? "Extracted (escalation)." : "No reliable evidence found."),
            actionMessage: parsed.actionMessage ?? defaultActionMessage(f, parsed.reason ?? "info_not_found"),
          };
        }

        // Stop escalating this field if:
        const minC = f.constraints?.confidenceThreshold ?? o.minConfidenceDefault;
        const done =
          filled[f.id].status === "extracted" ? filled[f.id].confidence >= minC : true; // accept absent/conflict after one try
        if (done) break;
      } catch (e) {
        // If escalation fails, keep original and stop escalating this field
        break;
      }
    }
  }
  timings.escalationMs = nowMs() - t0;

  // --- Stage 5: finalize
  const completeness = calcCompleteness(filled, structure);
  const responseTimeMs = nowMs() - start;

  // optional issues summary
  const issues: string[] = [];
  for (const f of structure.fields) {
    const r = filled[f.id];
    if (f.constraints?.required && r.status !== "extracted") {
      issues.push(`Missing required field: ${f.label ?? f.id} (${r.reason ?? r.status})`);
    }
  }

  const result: ExtractionResult = {
    transcript,
    processingType,
    responseTimeMs,
    timings,
    completeness,
    attemptsUsed: 1, // we did one all-fields attempt; expand if you add retries
    issues: issues.length ? issues : undefined,
    filled,
  };

  return result;
}
