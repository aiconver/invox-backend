import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { CurrentFieldValue, FilledField, FormTemplateField } from "./registry";


type Entry = readonly [string, FilledField];

// replace your stub with this
export async function generateChatResponse(
  combinedTranscript: string,
  fields: FormTemplateField[],
  currentValues: Record<string, CurrentFieldValue | undefined> | undefined,
  entries: Entry[],
): Promise<string> {
  // Build a compact, model-ready context
  const fieldById = new Map(fields.map(f => [f.id, f]));
  const updates = entries
    .map(([id, filled]) => {
      const meta = fieldById.get(id)!;
      return {
        id,
        label: meta.label,
        type: meta.type,
        changed: !!filled.changed,
        newValue: filled.value ?? null,
        prevValue: filled.previousValue ?? (currentValues?.[id]?.value ?? null),
        required: !!meta.required,
        confidence: filled.confidence ?? null,
        evidence: filled.evidence?.transcriptSnippet ?? null,
      };
    });

  const changed = updates.filter(u => u.changed);
  const pending = updates.filter(u => u.newValue === null && u.required);

  const chatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";

  const sys = [
    "You are an assistant summarizing speech-to-form extraction.",
    "Be concise, friendly, and factual.",
    "Do NOT invent values not grounded in the transcript.",
    "If nothing changed, say so.",
    "Prefer bullet points for updates; keep to <120 words total.",
  ].join(" ");

  const user = JSON.stringify({
    transcriptPreview: combinedTranscript.slice(0, 1200), // keep prompt lean
    updates,
  });

  const { text } = await generateText({
    model: openai(chatModel),
    system: sys,
    prompt: [
      "Given the transcript preview and extraction results, write a short update message for the user.",
      "Structure:",
      "1) One-sentence summary.",
      "2) Bullet list of changed fields as: Label: previous → new (confidence if available). Include evidence in quotes if present.",
      "3) If required fields are still missing, list them under 'Still needed'.",
      "",
      user,
    ].join("\n"),
    maxTokens: 250,
    temperature: 0.2,
  });

  // console.log("Question: ", sys, "Answer:", text)

  return text.trim();
}
