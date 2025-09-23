import { runField } from "./runField";
import { generateChatResponse } from "../chatService";
import {
  GetFilledTemplateInput,
  GetFilledTemplateResult,
  CurrentFieldValue,
} from "../registry";

export async function perFieldFiller(input: GetFilledTemplateInput): Promise<GetFilledTemplateResult> {
  const {
    transcript: legacyTranscript,
    fields,
    lang,
    currentValues,
    locale = "en-US",
    timezone = "Europe/Berlin",
    options,
    templateId,
    oldTranscript,
    newTranscript,
    fewShots,
  } = input as GetFilledTemplateInput & {
    oldTranscript?: string;
    newTranscript?: string;
  };

  const oldText = (oldTranscript ?? "").trim();
  const newText = (newTranscript ?? legacyTranscript ?? "").trim();

  if (!fields?.length) throw new Error("At least one template field is required.");
  if (!newText) throw new Error("Transcript is required.");

  const combinedTranscript = oldText ? `${oldText}\n${newText}` : newText;
  const modelName = process.env.OPENAI_FILL_MODEL || "gpt-4.1";

  const tasks = fields.map(f =>
    runField({
      field: f,
      oldText,
      newText,
      combinedTranscript,
      lang,
      templateId,
      locale,
      timezone,
      fewShots,
      options,
      current: currentValues?.[f.id] as CurrentFieldValue,
      modelName,
    })
  );

  const entries = await Promise.all(tasks);
  const chatResponse = await generateChatResponse(combinedTranscript, fields, currentValues, entries);

  return {
    filled: Object.fromEntries(entries),
    model: modelName,
    transcript: { old: oldText, new: newText, combined: combinedTranscript },
    chatResponse,
  };
}
