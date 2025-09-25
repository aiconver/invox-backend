import { z } from "zod";
import type { JwtUser } from "@/types/typed-request";
import { experimental_transcribe as transcribe } from "ai";
import { openai } from "@ai-sdk/openai";
import type { TranscribeResponse } from "@/types/transcribe-form";

// Base64 JSON upload schema
export const transcribeFormSchema = z.object({
  file: z.object({
    originalname: z.string().default("audio.wav"),
    mimetype: z.string().default("audio/wav"),
    base64: z.string().min(1, "file.base64 is required"), // base64 string only
  }),
});

// Everything is done directly here
export async function transcribeForm(
  input: z.infer<typeof transcribeFormSchema>,
  { user }: { user: JwtUser }
): Promise<{ success: true; data: TranscribeResponse; timestamp: string }> {
  const { base64, mimetype, originalname } = input.file;

  // Decode base64 -> Buffer
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("No audio data provided.");

  // Call Whisper directly
  const result = await transcribe({
    model: openai.transcription("whisper-1"),
    audio: buffer,
  });

  return {
    success: true,
    data: {
      transcript: result.text ?? "",
      language: result.language,
      durationInSeconds: result.durationInSeconds,
    },
    timestamp: new Date().toISOString(),
  };
}
