// types/fill-form.ts (add this type if missing)
export interface FewShotExample {
  text: string;
  expected: Record<string, any>;
}

// single-llm-one-field.ts
import { CurrentFieldValue, GetFilledTemplateInput, GetFilledTemplateResult } from "../types/fill-form";
import { runField } from "./utils/run-field";
import { generateChatResponse } from "./utils/chatbot-helper";
import { getFewShotsFromTranscript } from "./utils/get-few-shots";

/** ───────── logging helpers ───────── */
const DEBUG = process.env.DEBUG_FILL !== "0";
const DUMP_FULL_PROMPT = process.env.DUMP_FULL_PROMPT === "1";

function log(...args: any[]) {
  if (DEBUG) console.log(...args);
}
function warn(...args: any[]) {
  if (DEBUG) console.warn(...args);
}
function err(...args: any[]) {
  if (DEBUG) console.error(...args);
}
function short(value: unknown, max = 400) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + ` … [${s.length} chars]` : s;
}
function approxTokens(text: string) {
  return Math.ceil((text?.length ?? 0) / 4);
}
function maskSecret(s?: string | null) {
  if (!s) return "(missing)";
  if (s.length <= 8) return "*".repeat(s.length);
  return s.slice(0, 4) + "…" + s.slice(-4);
}

export async function singleLlmOneField(input: GetFilledTemplateInput): Promise<GetFilledTemplateResult> {
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
    fewShots: providedFewShots, // Allow pre-provided few shots
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

  log("\n[=== singleLlmOneField START ===]");
  log("env.OPENAI_FILL_MODEL:", modelName);
  log("env.OPENAI_API_KEY present:", maskSecret(process.env.OPENAI_API_KEY));
  log("Lang:", lang ?? "en");
  log("Fields count:", fields.length);
  log("Field IDs:", fields.map(f => f.id));
  log("Current values keys:", Object.keys(currentValues ?? {}));
  log("Old transcript (preview):", short(oldText, 300));
  log("New transcript (preview):", short(newText, 300));
  log("Provided fewShots count:", providedFewShots?.length ?? 0);

  // Retrieve few-shots if not provided
  let fewShots: any[] = providedFewShots ?? [];
  if (!fewShots.length) {
    try {
      console.time("[timer] fewShots");
      fewShots = await getFewShotsFromTranscript(combinedTranscript, fields, 3);
      console.timeEnd("[timer] fewShots");
      log(`Retrieved fewShots: count=${fewShots.length}`);
      if (fewShots.length > 0) {
        log("Few-shot examples preview:", fewShots.slice(0, 2).map((fs, i) => ({
          i,
          textPreview: short(fs.text, 160),
          expectedKeys: Object.keys(fs.expected ?? {}),
        })));
      }
    } catch (e: any) {
      err("[fewShots] retrieval failed:", e?.message ?? e);
      fewShots = [];
    }
  } else {
    log("Using provided few-shots");
  }

  // Process each field with timing and individual logging
  const tasks = fields.map(f => {
    log(`\n[Processing field: ${f.id}]`, { type: f.type, required: f.required });
    return runField({
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
    });
  });

  const entries = await Promise.all(tasks);
  
  // Log results summary
  log("\n[Field Processing Summary]");
  entries.forEach(([fieldId, result]) => {
    log(`- ${fieldId}:`, {
      value: short(String(result.value), 100),
      changed: result.changed,
      source: result.source,
      confidence: result.confidence
    });
  });

  let chatResponse: string | undefined;
  try {
    console.time("[timer] chatResponse");
    chatResponse = await generateChatResponse(combinedTranscript, fields, currentValues, entries);
    console.timeEnd("[timer] chatResponse");
    log("chatResponse (preview):", short(chatResponse, 600));
  } catch (e: any) {
    err("[chatResponse] failed:", e?.message ?? e);
    chatResponse = undefined;
  }

  log("[=== singleLlmOneField END ===]\n");

  return {
    filled: Object.fromEntries(entries),
    model: modelName,
    transcript: { old: oldText, new: newText, combined: combinedTranscript },
    chatResponse,
  };
}