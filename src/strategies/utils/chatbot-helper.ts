import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { CurrentFieldValue, FilledField, FormTemplateField } from "@/types/fill-form";

type Entry = readonly [string, FilledField];

export async function generateChatResponse(
  combinedTranscript: string,
  fields: FormTemplateField[],
  currentValues: Record<string, CurrentFieldValue | undefined> | undefined,
  entries: Entry[],
): Promise<string> {
  const fieldById = new Map(fields.map(f => [f.id, f]));

  // Build a compact, model-ready context
  const updates = entries.map(([id, filled]) => {
    const meta = fieldById.get(id)!;
    return {
      id,
      label: meta.label,
      type: meta.type,
      required: !!meta.required,
      // what changed (server-side computed)
      changed: !!filled.changed,
      newValue: filled.value ?? null,
      prevValue: filled.previousValue ?? (currentValues?.[id]?.value ?? null),
      // pass a short quote if we have one, but DO NOT say "evidence" in the copy
      quote: filled.evidence?.transcriptSnippet ?? null,
    };
  });

  const changed = updates.filter(u => u.changed);
  const pending = updates.filter(u => u.required && (u.newValue === null || u.newValue === undefined || u.newValue === ""));

  // Vary tone a bit to avoid repetitive phrasing
  const styleHints = [
    "keep it warm and professional",
    "keep it concise and friendly",
    "be encouraging and clear",
    "be matter-of-fact but personable",
  ];
  const styleHint = styleHints[Math.floor(Math.random() * styleHints.length)];

  const chatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";

  const system = [
    "You are a helpful assistant summarizing how you filled a form from a short transcript.",
    "Write in natural, conversational prose (no bullet points, no dashed lists, no headings).",
    "Never mention the words 'confidence' or 'evidence'.",
    "If you include a quote, introduce it naturally (e.g., “you said ‘…’”).",
    "If nothing changed, say so and reassure that previous entries are kept.",
    "If required fields are still missing, ask for them politely in one sentence.",
    "Keep to 2–5 sentences total.",
    `Tone: ${styleHint}.`,
  ].join(" ");

  const userPayload = {
    transcriptPreview: combinedTranscript.slice(0, 1200),
    updates, // includes label, prevValue, newValue, changed, required, quote
  };

  const prompt = [
    "Using the JSON below, write a short, friendly update to the user about what changed in their form.",
    "Constraints:",
    "- No bullet points or headings.",
    "- Do NOT use the words 'confidence' or 'evidence'.",
    "- Mention updated fields in flowing sentences, e.g., “I updated <Label> from <prev> to <new>”.",
    "- If a quote is present for an updated field, reference it naturally: “you said ‘<quote>’”.",
    "- If nothing changed, say you didn't change anything and kept previous entries.",
    "- If required fields are still missing, ask for them politely in one sentence, listing the labels inline.",
    "",
    JSON.stringify(userPayload),
  ].join("\n");

  const { text } = await generateText({
    model: openai(chatModel),
    system,
    prompt,
    maxTokens: 220,
    temperature: 0.6, // a bit more variety, still controlled
  });

  // Optional: add a tiny post-cleanup to avoid stray markdown/quotes
  return text.trim();
}
