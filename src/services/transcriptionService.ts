import { experimental_transcribe as transcribe } from "ai";
import { openai } from "@ai-sdk/openai";
import { UploadFile, TranscribeResponse } from "./registry";

export async function getAudioTranscript(file: UploadFile): Promise<TranscribeResponse> {
  if (!file?.buffer?.length) throw new Error("No audio data provided.");
  const modelName = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

  const result = await transcribe({
    model: openai.transcription(modelName as any),
    audio: file.buffer,
  });

  return {
    transcript: result.text ?? "",
    language: result.language,
    durationInSeconds: result.durationInSeconds,
  };
}
