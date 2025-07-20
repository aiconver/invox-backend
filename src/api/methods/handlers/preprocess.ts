export const preprocessTranscript = (text: string) =>
  text.trim()
    .replace(/\s+/g, " ")
    .replace(/[\"\"'']/g, '"')
    .replace(/\n+/g, "\n")
    .replace(/\t/g, " ");
