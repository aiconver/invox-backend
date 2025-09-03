import OpenAI from "openai";
import { AllFieldsResultSchema, FieldResultSchema } from "../validation/schemas";
import { buildPromptAllFields } from "../prompts/allFields";
import { buildPromptSingleField } from "../prompts/singleField";
import { retryWithJitter, withTimeout } from "../utils/retry";
import {
  DomainKnowledge,
  FewShotExample,
  Field,
  ProcessingType,
  Schema,
} from "../types/public";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type OpenAIJsonCallArgs = {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
};

async function callOpenAIJson<T = unknown>({
  system,
  user,
  model = "gpt-4o",
  temperature = 0,
  timeoutMs = 20000,
}: OpenAIJsonCallArgs): Promise<T> {
  const run = async () => {
    const completion = await withTimeout(
      openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        response_format: { type: "json_object" },
        max_tokens: 2048,
      }),
      timeoutMs,
      "OpenAI JSON call"
    );

    const raw = completion.choices?.[0]?.message?.content ?? "";
    // In rare cases JSON mode can still include whitespace; be lenient
    const cleaned = raw.trim();
    return JSON.parse(cleaned) as T;
  };

  // retry only on transient errors
  return retryWithJitter(run, { maxAttempts: 2, baseDelayMs: 500 });
}

/** All-fields pass (Stage 2) */
export async function inferAllFieldsWithOpenAI(args: {
  transcript: string;
  structure: Schema;
  knowledge?: DomainKnowledge;
  examples?: FewShotExample[];
  todayISO?: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<Record<string, unknown>> {
  const { system, user } = buildPromptAllFields(args);
  const json = await callOpenAIJson<Record<string, unknown>>({
    system,
    user,
    model: args.model,
    temperature: args.temperature ?? 0,
    timeoutMs: args.timeoutMs ?? 20000,
  });

  // Validate shape of each field result
  const parsed = AllFieldsResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Model returned invalid JSON for all-fields extraction: " + parsed.error.message);
  }
  return parsed.data;
}

/** Single-field escalation (Stage 4) */
export async function inferSingleFieldWithOpenAI(args: {
  transcriptChunk: string;
  field: Field;
  knowledge?: DomainKnowledge;
  todayISO?: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const { system, user } = buildPromptSingleField(args);
  const json = await callOpenAIJson({
    system,
    user,
    model: args.model,
    temperature: args.temperature ?? 0,
    timeoutMs: args.timeoutMs ?? 20000,
  });

  const parsed = FieldResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Model returned invalid JSON for single-field extraction: " + parsed.error.message);
  }
  return parsed.data;
}
