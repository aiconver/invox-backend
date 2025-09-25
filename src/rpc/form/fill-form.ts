import { z } from "zod";
import type { JwtUser } from "@/types/typed-request";
import { GetFilledTemplateResult } from "@/types/fill-form";
import { perFieldFiller } from "@/services/perFieldFiller";


// Input schema (mimics old GetFilledTemplateInput + extras)
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

  // Few-shots (stringified or array)
  fewShots: z.union([z.string(), z.array(z.unknown())]).optional(),

  // Options (fill mode, preserve edits, etc.)
  options: z.record(z.unknown()).optional(),

  // Approach: currently only perField supported
  approach: z.enum(["perField"]).optional(),
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

  const approach = normalized.approach ?? "perField";
  if (approach !== "perField") {
    throw new Error(`Unsupported filler approach: ${approach}`);
  }

  // Directly call perFieldFiller (no service indirection)
  const result = await perFieldFiller(normalized as any);

  return {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };
}
