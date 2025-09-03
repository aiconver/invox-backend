import { z } from "zod";

export const EvidenceSchema = z
  .object({ quote: z.string(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative() })
  .nullable();

export const FieldResultSchema = z.object({
  value: z.unknown().nullable(),
  confidence: z.number().min(0).max(1),
  status: z.enum(["extracted", "absent", "conflict"]),
  annotation: z.string().nullable().optional(),
  actionMessage: z.string().nullable().optional(),
  reason: z
    .enum(["info_not_found", "contradictory_evidence", "format_mismatch", "low_confidence", "not_applicable"])
    .nullable()
    .optional(),
  evidence: EvidenceSchema,
  provenance: z.object({ model: z.string().optional(), provider: z.string().optional(), stage: z.string().optional() }).optional(),
  warnings: z.array(z.string()).optional(),
});

export const AllFieldsResultSchema = z.record(FieldResultSchema);
