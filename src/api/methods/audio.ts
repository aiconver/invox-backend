// src/api/methods/audio.ts

/**
 * JSON-RPC method for audio transcription using a mock service.
 * @param {object} params - The parameters for the method.
 * @param {string} params.audioData - Base64 encoded audio data.
 * @returns {Promise<{message: string, transcript: string}>} - Promise resolving to success message and transcribed text.
 * @throws {Error} - If no audio data is provided.
 */
export const transcribe = async (params: { audioData: string }) => {
  const { audioData } = params;
  if (!audioData) {
    throw new Error('No audio data provided.');
  }

  console.log('Simulating audio transcription...');
  // Simulate transcription delay and output
  const mockTranscript = "This is a mock transcription of the audio input.";
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        message: 'Audio transcribed successfully (mock)!',
        transcript: mockTranscript
      });
    }, 1500); // Simulate a 1.5 second delay
  });
};
