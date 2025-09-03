export function buildPromptFollowupMessage(fieldLabel: string, reason: string, shortContext?: string) {
  const system = `You write one short, clear question to request a missing value from a user.`;
  const user = `
Field: ${fieldLabel}
Reason: ${reason}
Context: ${shortContext ?? ""}

Write ONE concise question, no preamble.
Return JSON: { "actionMessage": "<question>" }
`.trim();

  return { system, user };
}
