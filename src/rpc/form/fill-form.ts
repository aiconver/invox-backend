// src/api/form/handlers.ts
import { JwtUser } from "@/types/typed-request";
import z from "zod";
import { FormService } from "@/services/formService";

// ===== FILL =====

export const fillFormSchema = z.object({
  // Keep in sync with your old GetFilledTemplateInput
  // Required:
  fields: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.string(), // or enum if you have one
      // … add the rest per your Registry type
    })
  ),
  // Provide either newTranscript or legacy transcript:
  newTranscript: z.string().optional(),
  transcript: z.string().optional(), // legacy
  oldTranscript: z.string().optional(),

  // Optional fewShots (stringified or array):
  fewShots: z.union([z.string(), z.array(z.unknown())]).optional(),

  // Optional knobs you had:
  options: z.record(z.unknown()).optional(),

  // Optional, we’ll default to "perField" if not provided
  approach: z.enum(["perField", "fullContext"]).optional(),
});

export async function fillForm(
  input: z.infer<typeof fillFormSchema>,
  { user }: { user: JwtUser }
) {
  // normalize fewShots if stringified:
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

  // Validate transcript presence like your controller did
  const hasNew = typeof normalized.newTranscript === "string" && !!normalized.newTranscript.trim();
  const hasLegacy = typeof normalized.transcript === "string" && !!normalized.transcript.trim();
  if (!hasNew && !hasLegacy) {
    throw new Error(
      "Transcript is required. Provide `newTranscript` (preferred) or legacy `transcript`."
    );
  }

  if (!Array.isArray(normalized.fields) || normalized.fields.length === 0) {
    throw new Error("fields array is required.");
  }

  const approach = normalized.approach ?? "perField";

  const service = new FormService();
  const result = await service.getFilledTemplate(
    normalized as any, // matches your existing GetFilledTemplateInput shape
    approach as any
  );

  return {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };
}

