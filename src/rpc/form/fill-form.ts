import { z } from "zod";
import type { JwtUser } from "@/types/typed-request";
import type { GetFilledTemplateResult } from "@/types/fill-form";
import { singleLlmOneField } from "@/strategies/single-llm-one-field";
import { singleLlmAllField } from "@/strategies/single-llm-all-field";

/** CurrentFieldValue (loose) */
const zCurrentFieldValue = z.object({
  value: z.union([z.string(), z.number(), z.null()]).optional(),
  source: z.enum(["ai", "user"]).optional(),
  locked: z.boolean().optional(),
});

/** Record of current values keyed by field id */
const zCurrentValues = z.record(z.string(), zCurrentFieldValue).optional();

// Input schema
export const fillFormSchema = z.object({
  fields: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.string(),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
      description: z.string().optional(),
      pattern: z.string().optional(),
    })
  ),

  // Transcript options
  newTranscript: z.string().optional(),
  transcript: z.string().optional(), // legacy
  oldTranscript: z.string().optional(),

  // Few-shots
  fewShots: z.union([z.string(), z.array(z.unknown())]).optional(),

  // Options
  options: z.record(z.unknown()).optional(),

  // Approach
  approach: z.enum(["singleLlmOneField", "singleLlmAllField"]).optional(),

  // 🔴 NEW: pass previous values from client
  currentValues: zCurrentValues,
});

export async function fillForm(
  input: z.infer<typeof fillFormSchema>,
  { user }: { user: JwtUser }
): Promise<{ success: true; data: GetFilledTemplateResult; timestamp: string }> {
  // Normalize fewShots if it arrived as JSON string
  const normalized = {
    ...input,
    fewShots:
      typeof input.fewShots === "string"
        ? (() => {
            try {
              return JSON.parse(input.fewShots);
            } catch {
              return undefined;
            }
          })()
        : input.fewShots,
  };

  // Sanity logs (helps confirm currentValues is coming through)
  console.log("[fillForm] fields:", normalized.fields?.length);
  console.log(
    "[fillForm] currentValues keys:",
    normalized.currentValues ? Object.keys(normalized.currentValues).length : 0
  );

  // Validate transcripts
  const hasNew = normalized.newTranscript?.trim();
  const hasLegacy = normalized.transcript?.trim();
  if (!hasNew && !hasLegacy) {
    throw new Error(
      "Transcript is required. Provide `newTranscript` (preferred) or legacy `transcript`."
    );
  }

  // Validate fields
  if (!Array.isArray(normalized.fields) || normalized.fields.length === 0) {
    throw new Error("fields array is required.");
  }

  const approach = normalized.approach ?? "singleLlmAllField";

  let result: GetFilledTemplateResult;
  if (approach === "singleLlmOneField") {
    // ensure currentValues is forwarded
    result = await singleLlmOneField(normalized as any);
  } else if (approach === "singleLlmAllField") {
    // ensure currentValues is forwarded
    result = await singleLlmAllField(normalized as any);
  } else {
    throw new Error(`Unsupported filler approach: ${approach}`);
  }

  return {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };
}
