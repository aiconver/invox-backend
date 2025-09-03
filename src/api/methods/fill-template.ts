import { z } from "zod";               // adjust path if different
import type { JwtUser } from "@/types/typed-request";
import { ProcessingType } from "./alpha/types/public";
import { extractStructuredData } from "./alpha/orchestrator/extract";

// ---------- Request validation ----------

const KnowledgeItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), title: z.string().optional(), content: z.string() }),
  z.object({
    kind: z.literal("glossary"),
    terms: z.array(z.object({ term: z.string(), definition: z.string() })),
  }),
  z.object({ kind: z.literal("rules"), rules: z.array(z.string()) }),
  z.object({ kind: z.literal("faq"), pairs: z.array(z.object({ q: z.string(), a: z.string() })) }),
]);

const FieldConstraintSchema = z.object({
  required: z.boolean().optional(),
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  enum: z.array(z.string()).optional(),
  format: z.enum(["iban", "vat", "zipcode", "country", "url"]).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  parseLocale: z.string().optional(),
});

const FieldSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  type: z.enum([
    "string","number","integer","date","datetime","boolean","enum","email","phone","currency","array","object"
  ]),
  description: z.string().optional(),
  constraints: FieldConstraintSchema.optional(),
  properties: z.record(z.any()).optional(),
  items: z.any().optional(),
  priority: z.enum(["high","medium","low"]).optional(),
});

const SchemaSchema = z.object({
  version: z.string(),
  title: z.string().optional(),
  fields: z.array(FieldSchema).min(1),
});

const InputSchema = z.object({
  transcript: z.union([
    z.string(),
    z.object({ text: z.string(), locale: z.string().optional(), sourceId: z.string().optional() }),
  ]),
  structure: SchemaSchema,
  knowledge: z.object({
    context: z.string().optional(),
    items: z.array(KnowledgeItemSchema).optional(),
  }).optional(),
  examples: z.array(
    z.object({
      transcript: z.string(),
      answers: z.record(z.unknown()),
      notes: z.string().optional(),
    })
  ).optional(),
  processingType: z.nativeEnum(ProcessingType).optional(),
  options: z.object({
    model: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    minConfidenceDefault: z.number().min(0).max(1).optional(),
    maxEscalationsPerField: z.number().int().min(0).max(3).optional(),
    todayISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).optional(),
});

// ---------- RPC method ----------

/**
 * JSON-RPC: "ai.fillTemplate"
 * @param params see InputSchema
 * @param ctx { user } from JWT middleware
 */
export async function fillTemplate(
  params: unknown,
  ctx: { user: JwtUser }
) {
  // Optional: enforce roles at method level (route already checks)
  if (!ctx?.user) {
    throw new Error("Unauthorized");
  }

  const parsed = InputSchema.safeParse(params);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    const err: any = new Error(`Invalid params: ${msg}`);
    err.status = 400;
    throw err;
  }

  const { transcript, structure, knowledge, examples, processingType, options } = parsed.data;

  // Call orchestrator (returns your ExtractionResult)
  const result = await extractStructuredData(
    { transcript, structure, knowledge, examples, processingType },
    {
      model: options?.model ?? "gpt-4o",
      timeoutMs: options?.timeoutMs ?? 20_000,
      minConfidenceDefault: options?.minConfidenceDefault ?? 0.7,
      maxEscalationsPerField: options?.maxEscalationsPerField ?? 1,
      todayISO: options?.todayISO,
    }
  );

  // You may redact transcript in response if needed (PII/logging policy)
  return result;
}
