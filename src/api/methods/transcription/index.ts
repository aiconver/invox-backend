import OpenAI from "openai";
import { Buffer } from "buffer";
import { Readable } from "stream";

const openai = new OpenAI();

/**
 * Transcribes base64-encoded audio using OpenAI Whisper (SDK).
 */
export async function transcribeAudio(audioBase64: string): Promise<string> {
  const matches = audioBase64.match(/^data:(.*?);base64,(.*)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 audio format");
  }

  const mimeType = matches[1];
  const format = mimeType.split("/")[1]; // e.g., "wav", "mp3"
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  // Convert Buffer to a Readable stream
  const stream = Readable.from(buffer);

  // Use OpenAI SDK — file must be a Readable stream with a `path` or `name` property
  const file = Object.assign(stream, { path: `audio.${format}` }); // `path` is used by SDK to set filename

  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
  });

  return response.text.trim();
}
