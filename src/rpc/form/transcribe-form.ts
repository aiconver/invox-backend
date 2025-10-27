import { z } from "zod";
import type { JwtUser } from "@/types/typed-request";
import OpenAI from "openai";
import type { TranscribeResponse } from "@/types/transcribe-form";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Base64 JSON upload schema
export const transcribeFormSchema = z.object({
  file: z.object({
    originalname: z.string().default("audio.wav"),
    mimetype: z.string().default("audio/wav"),
    base64: z.string().min(1, "file.base64 is required"),
  }),
  lang: z.string().optional(), // ISO 639-1 code like "en", "de", "es"
});

export async function transcribeForm(
  input: z.infer<typeof transcribeFormSchema>,
  { user }: { user: JwtUser }
): Promise<{ success: true; data: TranscribeResponse; timestamp: string }> {
  const { base64, mimetype, originalname } = input.file;
  const { lang } = input;

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("No audio data provided.");

  const file = new File([buffer], originalname, { type: mimetype });

  const result = await openai.audio.transcriptions.create({
    file: file,
    model: "whisper-1",
    ...(lang && { language: lang }), // Use language parameter
    response_format: "verbose_json",
  });

  return {
    success: true,
    data: {
      transcript: result.text ?? "",
      language: result.language,
      durationInSeconds: result.duration,
    },
    timestamp: new Date().toISOString(),
  };
}