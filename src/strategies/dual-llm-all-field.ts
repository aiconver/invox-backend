// dual-llm-all-field.ts
// One-file ensemble extractor: GPT + Gemini → Verifier (pick/merge/keep)

import {
  CurrentFieldValue,
  FilledField,
  FormTemplateField,
  GetFilledTemplateInput,
  GetFilledTemplateResult,
} from "@/types/fill-form";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { getFewShotsFromTranscript } from "./utils/get-few-shots";
import { google } from "@ai-sdk/google";

// ───────── config & logging ─────────
const DEBUG = process.env.DEBUG_FILL !== "0";
const DUMP_FULL_PROMPT = process.env.DUMP_FULL_PROMPT === "1";

function log(...a: any[]) { if (DEBUG) console.log(...a); }
function warn(...a: any[]) { if (DEBUG) console.warn(...a); }
function err(...a: any[]) { if (DEBUG) console.error(...a); }
function short(v: unknown, m = 400) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return !s ? "" : (s.length > m ? s.slice(0, m) + ` … [${s.length} chars]` : s);
}
function approxTokens(t: string) { return Math.ceil((t?.length ?? 0) / 4); }
function maskSecret(s?: string | null) {
  if (!s) return "(missing)";
  if (s.length <= 8) return "*".repeat(s.length);
  return s.slice(0, 4) + "…" + s.slice(-4);
}

// ───────── multi-value fields (MUC-4) ─────────
// Fields that can be multi-valued in MUC-4 and should accept string[] too
const MULTI_VALUE_FIELD_IDS = new Set([
  "perpetratorIndividual",
  "perpetratorOrganization",
  "target",
  "victim",
  "weapon",
]);

export function isDE(lang?: string) {
  return (lang ?? "en").toLowerCase().startsWith("de");
}

// ───────── Zod schema per field ─────────
function zodFieldValueSchema(field: FormTemplateField): z.ZodTypeAny {
  switch (field.type) {
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
    case "number":
      return z.number().finite().nullable();
    case "enum":
      return field.options?.length
        ? z.enum(field.options as [string, ...string[]]).nullable()
        : z.string().nullable();
    default:
      return MULTI_VALUE_FIELD_IDS.has(field.id)
        ? z.union([z.string(), z.array(z.string())]).nullable()
        : z.string().nullable();
  }
}

// ───────── normalization helpers ─────────
function normalizeLLMValue(field: FormTemplateField, v: unknown) {
  if (v == null) return null;

  // Join arrays to comma-separated string for multi-value fields
  if (MULTI_VALUE_FIELD_IDS.has(field.id) && Array.isArray(v)) {
    const joined = v.map(x => String(x).trim()).filter(Boolean).join(", ");
    return joined || null;
  }

  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }

  return v as any;
}

function formatCurrentValues(
  fields: FormTemplateField[],
  currentValues?: Record<string, CurrentFieldValue>
) {
  return fields.map((f) => {
    const cv = currentValues?.[f.id];
    return {
      id: f.id,
      label: f.label,
      type: f.type,
      locked: !!cv?.locked,
      value: cv?.value ?? null,
    };
  });
}


// ───────── prompt builder (NEW transcript only, lock-respecting) ─────────
function buildPrompt({
  fields,
  oldText,
  newText,
  fewShots,
  lang,
  currentValues,
}: {
  fields: FormTemplateField[];
  oldText: string;
  newText: string;
  fewShots?: any[];
  lang: string;
  currentValues?: Record<string, CurrentFieldValue>;
}) {
  const de = isDE(lang);

  const header = de
    ? [
        "Aufgabe: Erstelle die endgültigen Feldwerte.",
        "Nur das NEUE Transkript ist Quelle für neue Informationen.",
        "Wenn das NEUE Transkript ein Feld NICHT erwähnt, BEHALTE den aktuellen Wert.",
        "Aktualisiere NUR bei klarer Evidenz aus dem NEUEN Transkript.",
        "locked=true Felder NIEMALS überschreiben.",
        "Datumsformat: YYYY-MM-DD. Zahlen ohne Einheiten.",
        "Antwort NUR im JSON-Format: { fieldId: { value } }",
      ].join(" ")
    : [
        "Task: Produce the FINAL values for each field.",
        "Only the NEW transcript is the source for new info.",
        "If the NEW transcript does NOT mention a field, KEEP the current value.",
        "Update ONLY when the NEW transcript provides clear evidence.",
        "For locked=true fields, NEVER overwrite.",
        "Dates must be YYYY-MM-DD. Numbers plain (no units).",
        "Answer ONLY with JSON: { fieldId: { value } }",
      ].join(" ");

  const fs = (fewShots ?? [])
    .slice(0, 2)
    .map((ex: any, i: number) => {
      const expected = JSON.stringify(ex.expected, null, 2);
      return de
        ? `Beispiel ${i + 1}:\nText: ${ex.text}\nErwartet: ${expected}`
        : `Example ${i + 1}:\nText: ${ex.text}\nExpected: ${expected}`;
    })
    .join("\n\n");

  const fieldList = fields
    .map((f) => {
      const meta = `${f.id} (${f.label}, type=${f.type}${f.required ? ", required" : ""})`;
      const opts =
        f.type === "enum" && f.options?.length
          ? `\n  - ${de ? "Zulässige Werte" : "Allowed values"}: ${f.options.join(", ")}`
          : "";
      const desc = f.description ? `\n  - ${de ? "Leitlinien" : "Guidelines"}: ${f.description}` : "";
      return meta + opts + desc;
    })
    .join("\n\n");

  const oldLabel = de ? "ALTES Transkript:" : "OLD transcript:";
  const newLabel = de ? "NEUES Transkript:" : "NEW transcript:";
  const currentLabel = de ? "Aktuelle Werte:" : "Current values:";

  return [
    header,
    "",
    fs,
    "",
    de ? "Felder:" : "Fields:",
    fieldList,
    "",
    currentLabel,
    JSON.stringify(formatCurrentValues(fields, currentValues), null, 2),
    "",
    oldLabel,
    oldText || "(leer)",
    "",
    newLabel,
    newText,
  ].join("\n");
}

// ───────── Verifier (in-file) ─────────

const ORG_ALIASES: Record<string, string> = {
  "FARABUNDO MARTI NATIONAL LIBERATION FRONT": "FMLN",
  "MANUEL RODRIGUEZ PATRIOTIC FRONT": "FPMR",
};

function splitCsv(s?: string | null): string[] {
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean);
}
function uniqueKeepOrder(arr: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const x of arr) { if (!seen.has(x)) { seen.add(x); out.push(x); } }
  return out;
}
function normalizeOrgAlias(s: string): string {
  const key = s.replace(/\s*\(.*?\)\s*/g, "").trim().toUpperCase();
  return ORG_ALIASES[key] || s;
}

async function runEnsembleVerifier({
  combinedTranscript,
  fields,
  lang,
  currentValues,
  gpt,
  gemini,
}: {
  combinedTranscript: string;
  fields: FormTemplateField[];
  lang: string;
  currentValues?: Record<string, CurrentFieldValue>;
  gpt: Record<string, FilledField>;
  gemini: Record<string, FilledField>;
}): Promise<Record<string, FilledField>> {

  const outSchema = z.object(
    Object.fromEntries(
      fields.map((f) => [
        f.id,
        z.object({
          decision: z.enum(["gpt", "gemini", "merge", "keep_current"]),
          value: z.union([z.string().nullable(), z.array(z.string()).nullable()]).nullable(),
          reason: z.string().optional(),
        }),
      ])
    )
  );

  const de = isDE(lang);
  const header = de
    ? [
        "Rolle: Du bist ein strenger Verifizierer.",
        "Quelle für NEUE Informationen ist NUR das NEUE Transkript (siehe Kontext).",
        "Wähle pro Feld GENAU EINE Option: 'gpt', 'gemini', 'merge', oder 'keep_current'.",
        "Regeln:",
        "- locked=true NIEMALS überschreiben.",
        "- Wenn beide Kandidaten leer/unsicher sind, nutze 'keep_current'.",
        "- 'merge' ist NUR für Mehrfach-Felder (PerpInd, PerpOrg, Target, Victim, Weapon) erlaubt.",
        "- Bei Merge: qualitätsbereinigt + deduplizieren.",
        "- Für 'enum' Felder: KEIN Merge; wähle den besseren Einzelwert.",
        "- Für PerpOrg: wenn Langform + Akronym existiert, nutze NUR das kanonische Kurz-Akronym; keine Klammern.",
        "Gib NUR JSON im Format { fieldId: { decision, value, reason } } zurück.",
      ].join(" ")
    : [
        "Role: You are a strict verifier.",
        "The source of NEW information is ONLY the NEW transcript (see context).",
        "Choose EXACTLY ONE per field: 'gpt', 'gemini', 'merge', or 'keep_current'.",
        "Rules:",
        "- Never overwrite locked=true.",
        "- If both candidates are empty/uncertain, use 'keep_current'.",
        "- 'merge' is ONLY for multi-value fields (PerpInd, PerpOrg, Target, Victim, Weapon).",
        "- On merge: quality-filter + deduplicate.",
        "- For 'enum' fields: NO merge; pick the better single value.",
        "- For PerpOrg: if long form + acronym exist, output ONLY the canonical short acronym; no parentheses.",
        "Return JSON ONLY as { fieldId: { decision, value, reason } }.",
      ].join(" ");

  const fieldSummaries = fields.map((f) => {
    const cv = currentValues?.[f.id];
    const g = gpt[f.id]?.value ?? null;
    const m = gemini[f.id]?.value ?? null;
    return {
      id: f.id, label: f.label, type: f.type, required: !!f.required,
      locked: !!cv?.locked,
      current: cv?.value ?? null,
      gpt: g,
      gemini: m,
      guidelines: f.description ?? "",
      options: f.type === "enum" ? f.options ?? [] : [],
    };
  });

  const prompt = [
    header,
    "",
    "FIELDS:",
    JSON.stringify(fieldSummaries, null, 2),
    "",
    "CONTEXT (for reference):",
    combinedTranscript.slice(0, 6000),
  ].join("\n");

  const verifierModel = process.env.OPENAI_VERIFIER_MODEL || "gpt-5-mini";
  const res = await generateObject({
    model: openai(verifierModel),
    schema: outSchema,
    prompt,
    temperature: 0.2,
  });

  const decisions = res.object as Record<
    string,
    { decision: "gpt" | "gemini" | "merge" | "keep_current"; value?: any }
  >;

  const finalFilled: Record<string, FilledField> = {};

  for (const f of fields) {
    const dec = decisions[f.id]?.decision ?? "keep_current";
    const locked = !!currentValues?.[f.id]?.locked;
    const prevVal = currentValues?.[f.id]?.value ?? null;

    let finalVal: any = prevVal;
    let src = currentValues?.[f.id]?.source ?? "ai";

    if (!locked) {
      if (dec === "gpt") {
        finalVal = gpt[f.id]?.value ?? prevVal;
        src = "ai";
      } else if (dec === "gemini") {
        finalVal = gemini[f.id]?.value ?? prevVal;
        src = "ai";
      } else if (dec === "merge" && MULTI_VALUE_FIELD_IDS.has(f.id)) {
        const g = splitCsv(String(gpt[f.id]?.value ?? ""));
        const m = splitCsv(String(gemini[f.id]?.value ?? ""));
        let merged = uniqueKeepOrder([...g, ...m]);
        // PerpOrg: prefer short alias, drop parentheses
        if (f.id === "PerpOrg") {
          merged = merged.map(normalizeOrgAlias).map(s => s.replace(/\s*\(.*?\)\s*/g, "").trim());
          merged = uniqueKeepOrder(merged);
        }
        finalVal = merged.join(", ") || prevVal;
        src = "ai";
      } else if (dec === "keep_current") {
        finalVal = prevVal;
      }
    }

    const changed = finalVal !== prevVal;
    finalFilled[f.id] = {
      value: finalVal ?? null,
      changed,
      previousValue: changed ? prevVal : undefined,
      source: changed ? src : (currentValues?.[f.id]?.source ?? src),
    };
  }

  return finalFilled;
}

// ───────── main: dual LLM + verifier ─────────

export async function dualLlmAllField(
  input: GetFilledTemplateInput
): Promise<GetFilledTemplateResult> {
  const {
    transcript: legacyTranscript,
    fields,
    lang,
    currentValues,
    oldTranscript,
    newTranscript,
    needFewshotExamples,
  } = input as GetFilledTemplateInput & { oldTranscript?: string; newTranscript?: string };

  const oldText = (oldTranscript ?? "").trim();
  const newText = (newTranscript ?? legacyTranscript ?? "").trim();
  const combinedTranscript = oldText ? `${oldText}\n${newText}` : newText;

  log("\n[=== dualLlmAllField START ===]");
  log("env.OPENAI_FILL_MODEL_GPT:", process.env.OPENAI_FILL_MODEL_GPT || "gpt-5");
  log("env.OPENAI_FILL_MODEL_GEMINI:", process.env.OPENAI_FILL_MODEL_GEMINI || "gemini-2.5-flash");
  log("env.OPENAI_VERIFIER_MODEL:", process.env.OPENAI_VERIFIER_MODEL || "gpt-5");
  log("env.OPENAI_API_KEY present:", maskSecret(process.env.OPENAI_API_KEY));
  log("Lang:", lang ?? "en");
  log("Fields:", fields.map((f) => ({ id: f.id, type: f.type, required: !!f.required })));
  log("Current values keys:", Object.keys(currentValues ?? {}));
  log("Old transcript (preview):", short(oldText, 300));
  log("New transcript (preview):", short(newText, 300));

  if (!fields?.length) throw new Error("At least one field is required.");
  if (!newText) throw new Error("Transcript is required.");

  // Few-shots
  let fewShots: any[] = [];
  try {
    console.time("[timer] fewShots");
    if (!needFewshotExamples) {
      log("Skipping few-shot examples as not needed.");
      fewShots = [];
    }
    else{
      fewShots = await getFewShotsFromTranscript(combinedTranscript, fields, 2);
      console.timeEnd("[timer] fewShots");
      log("fewShots count:", fewShots.length);
    }
  } catch (e: any) {
    err("[fewShots] retrieval failed:", e?.message ?? e);
    fewShots = [];
  }

  // Schema + Prompt
  const schema = z.object(
    Object.fromEntries(
      fields.map((f) => [
        f.id,
        z.object({
          value: zodFieldValueSchema(f),
        }),
      ])
    )
  );

  const prompt = buildPrompt({ fields, oldText, newText, fewShots, lang: lang ?? "en", currentValues });
  const promptInfo = { chars: prompt.length, approxTokens: approxTokens(prompt) };
  log("Prompt size:", promptInfo);
  if (DUMP_FULL_PROMPT) warn("[prompt FULL]\n" + prompt);
  else log("[prompt PREVIEW]\n" + short(prompt, 2000));

  // Models (configure via env)
  const gptModel = process.env.OPENAI_FILL_MODEL_GPT || "gpt-5";
  const geminiModel = process.env.OPENAI_FILL_MODEL_GEMINI || "gemini-2.5-flash"; // If routed via another provider, swap below.

  // Run GPT
  let rawGptObj: any;
  try {
    console.time("[timer] GPT generateObject");
    const gptRes = await generateObject({ model: openai(gptModel), schema, prompt });
    console.timeEnd("[timer] GPT generateObject");
    rawGptObj = gptRes.object;
    log("[GPT] output preview:", short(JSON.stringify(rawGptObj), 800));
  } catch (e: any) {
    err("[GPT] generateObject failed:", e?.message ?? e);
    rawGptObj = {};
  }

  // Run Gemini (swap provider if needed)
  let rawGemObj: any;
  try {
    console.time("[timer] Gemini generateObject");
    const gemRes = await generateObject({ model: google(geminiModel), schema, prompt });
    console.timeEnd("[timer] Gemini generateObject");
    rawGemObj = gemRes.object;
    log("[Gemini] output preview:", short(JSON.stringify(rawGemObj), 800));
  } catch (e: any) {
    err("[Gemini] generateObject failed:", e?.message ?? e);
    rawGemObj = {};
  }

  // Build candidates
  const candidateGPT: Record<string, FilledField> = {};
  const candidateGEM: Record<string, FilledField> = {};
  for (const f of fields) {
    const prev = currentValues?.[f.id];
    const prevVal = prev?.value ?? null;

    const vG = normalizeLLMValue(f, rawGptObj?.[f.id]?.value ?? null);
    const vM = normalizeLLMValue(f, rawGemObj?.[f.id]?.value ?? null);

    candidateGPT[f.id] = {
      value: vG ?? prevVal,
      changed: (vG ?? prevVal) !== prevVal,
      previousValue: (vG ?? prevVal) !== prevVal ? prevVal : undefined,
      source: (vG ?? prevVal) !== prevVal ? "ai" : (prev?.source ?? "ai"),
    };
    candidateGEM[f.id] = {
      value: vM ?? prevVal,
      changed: (vM ?? prevVal) !== prevVal,
      previousValue: (vM ?? prevVal) !== prevVal ? prevVal : undefined,
      source: (vM ?? prevVal) !== prevVal ? "ai" : (prev?.source ?? "ai"),
    };
  }

  // Verifier: pick/merge/keep
  let verified: Record<string, FilledField>;
  try {
    console.time("[timer] verifier");
    verified = await runEnsembleVerifier({
      combinedTranscript,
      fields,
      lang: lang ?? "en",
      currentValues,
      gpt: candidateGPT,
      gemini: candidateGEM,
    });
    console.timeEnd("[timer] verifier");
  } catch (e: any) {
    err("[verifier] failed:", e?.message ?? e);
    verified = candidateGPT; // fallback
  }

  log("[=== dualLlmAllField END ===]\n");
  return {
    filled: verified,
    model: `ensemble:${gptModel}+${geminiModel}`,
    transcript: { old: oldText, new: newText, combined: combinedTranscript },
    chatResponse: undefined,
  };
}
