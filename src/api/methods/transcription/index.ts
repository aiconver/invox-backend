// src/api/methods/transcription/transcribeAudio.ts

export async function transcribeAudio(audio: string): Promise<string> {
  return `
    The employee ID is 54321.
    They left the company because they got a better offer.
    Their feedback is that the team was supportive and the experience was good overall.
  `;
}
