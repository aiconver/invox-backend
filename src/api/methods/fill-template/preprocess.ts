export const preprocessTranscript = (t: string) => t.trim()
  .replace(/\s+/g, ' ')
  .replace(/[\"\"'']/g, '"')
  .replace(/\n+/g, '\n')
  .replace(/\t/g, ' ');
