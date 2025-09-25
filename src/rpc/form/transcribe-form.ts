import { FormService } from "@/services/formService";
import { JwtUser } from "@/types/typed-request";
import z from "zod";

// Option (2): base64 JSON upload
export const transcribeFormSchema = z.object({
  file: z.object({
    originalname: z.string().default("audio.wav"),
    mimetype: z.string().default("audio/wav"),
    // base64 string (no data: prefix)
    base64: z.string().min(1, "file.base64 is required"),
  }),
});

export async function transcribeForm(
  input: z.infer<typeof transcribeFormSchema>,
  { user }: { user: JwtUser }
) {
  const { base64, mimetype, originalname } = input.file;

  // Decode base64 -> Buffer
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("No audio data provided.");

  const service = new FormService();
  const result = await service.getAudioTranscript({
    buffer,
    originalname,
    mimetype,
  });

  return {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };
}
