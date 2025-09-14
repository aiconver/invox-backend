// src/services/formService.ts
import { experimental_transcribe as transcribe } from "ai";
import { openai } from "@ai-sdk/openai";

export type TranscribeResponse = {
  transcript: string;
  language?: string;
  durationInSeconds?: number;
};

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

export class formService {
  /**
   * Takes a raw uploaded audio file (buffer) and returns its transcript
   * using Vercel AI SDK transcription.
   */
  async getAudioTranscript(file: UploadFile): Promise<TranscribeResponse> {
    if (!file?.buffer?.length) throw new Error("No audio data provided.");

    // Choose model via env or default to whisper-1 (per docs)
    const modelName = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

    const result = await transcribe({
      model: openai.transcription(modelName as any), // e.g., 'whisper-1'
      audio: file.buffer, // Buffer from Multer memory storage
      // Optional params you can enable later:
      // language: "en",
      // prompt: "Project-specific vocabulary here",
      // temperature: 0,
    });

    return {
      transcript: result.text ?? "",
      language: result.language,
      durationInSeconds: result.durationInSeconds,
    };
  }

  /// more service for form yet
}
