// utils/prompt-builder.ts
import { FormTemplateField } from "../../types/fill-form";
import { isDE } from "../single-llm-all-field";

/** ───────── logging helpers ───────── */
const DEBUG = process.env.DEBUG_FILL !== "0";

function log(...args: any[]) {
  if (DEBUG) console.log(...args);
}

function short(value: unknown, max = 400) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + ` … [${s.length} chars]` : s;
}

export function buildPrompt({
  field,
  oldText,
  newText,
  templateId,
  lang,
  locale,
  timezone,
  descLine,
  perFieldDemos = [],
  rules,
  currentValue,
}: {
  field: FormTemplateField;
  oldText: string;
  newText: string;
  templateId?: string;
  lang: string;
  locale: string;
  timezone: string;
  descLine?: string | null;
  perFieldDemos: any[];
  rules: string[];
  currentValue?: any;
}) {
  const de = isDE(lang);

  log(`[prompt-builder] Building prompt for field: ${field.id}`, {
    perFieldDemosCount: perFieldDemos.length,
    currentValue: short(currentValue, 100)
  });

  const headerLine = de
    ? `Vorlagen-ID: ${templateId ?? "(nicht angegeben)"} | Gebietsschema: ${locale} | Zeitzone: ${timezone}`
    : `Template ID: ${templateId ?? "(unspecified)"} | Locale: ${locale} | Timezone: ${timezone}`;

  const fieldLine = de
    ? `Feld: ${field.label} (id: ${field.id}, type: ${field.type}${field.required ? ", erforderlich" : ""})`
    : `Field: ${field.label} (id: ${field.id}, type: ${field.type}${field.required ? ", required" : ""})`;

  const currentLine = de
    ? `Aktueller Wert: ${currentValue !== undefined ? JSON.stringify(currentValue) : "null"}`
    : `Current value: ${currentValue !== undefined ? JSON.stringify(currentValue) : "null"}`;

  // 🚨 GENERIC FIX: Add formatting rules based on field type, not field ID
  const formattingRules = [...rules];
  
  // For textarea fields (which typically contain lists), specify comma-separated format
  if (field.type === "textarea") {
    formattingRules.push(
      de 
        ? `Bei mehreren Werten: Als komma-getrennte Zeichenkette zurückgeben (z.B. "Wert1, Wert2, Wert3"). Nicht als Array.`
        : `For multiple values: Return as comma-separated string (e.g., "value1, value2, value3"). Not as array.`
    );
  }

  // For enum fields, restrict to allowed values
  if (field.type === "enum" && field.options?.length) {
    formattingRules.push(
      de
        ? `Nur einer dieser Werte: ${field.options.join(", ")}`
        : `Only one of these values: ${field.options.join(", ")}`
    );
  }

  const rulesTitle = de ? "Regeln:" : "Rules:";

  const oldLabel = de
    ? "ALTES Transkript (nur Kontext; NICHT daraus extrahieren):"
    : "OLD transcript (context only; do not extract from this):";

  const newLabel = de
    ? "NEUES Transkript (AUSSCHLIESSLICH hieraus extrahieren):"
    : "NEW transcript (extract ONLY from this):";

  // 🚨 GENERIC OUTPUT FORMAT - works for any field type
  const outputFormat = de
    ? `AUSGABEFORMAT: { "value": "string_oder_null", "confidence": zahl_zwischen_0_und_1 }`
    : `OUTPUT FORMAT: { "value": "string_or_null", "confidence": number_between_0_and_1 }`;

  // Add few-shot examples if available
  let fewShotSection = "";
  if (perFieldDemos.length > 0) {
    log(`[prompt-builder] Adding ${perFieldDemos.length} few-shot examples for field: ${field.id}`);
    
    const exampleTitle = de ? "BEISPIELE:" : "EXAMPLES:";
    const examples = perFieldDemos.map((demo, index) => {
      const textLabel = de ? `Text ${index + 1}:` : `Text ${index + 1}:`;
      const expectedLabel = de ? `Erwartet:` : `Expected:`;
      return `${textLabel} ${short(demo.text, 300)}\n${expectedLabel} ${JSON.stringify(demo.expected)}`;
    }).join("\n\n");
    
    fewShotSection = `\n\n${exampleTitle}\n${examples}`;
  }

  // 🚨 GENERIC EXAMPLES - based on field type, not specific fields
  let genericExamples = "";
  if (field.type === "textarea") {
    genericExamples = de
      ? `BEISPIELE:\n- Mehrere Werte: {"value": "Wert1, Wert2, Wert3", "confidence": 0.9}\n- Keine Werte: {"value": null, "confidence": 0.8}\n- Ein Wert: {"value": "Wert1", "confidence": 0.95}`
      : `EXAMPLES:\n- Multiple values: {"value": "value1, value2, value3", "confidence": 0.9}\n- No values: {"value": null, "confidence": 0.8}\n- Single value: {"value": "value1", "confidence": 0.95}`;
  } else if (field.type === "enum") {
    genericExamples = de
      ? `BEISPIELE:\n- Gültiger Wert: {"value": "${field.options?.[0] || "OPTION"}", "confidence": 0.9}\n- Kein Wert: {"value": null, "confidence": 0.8}`
      : `EXAMPLES:\n- Valid value: {"value": "${field.options?.[0] || "OPTION"}", "confidence": 0.9}\n- No value: {"value": null, "confidence": 0.8}`;
  } else {
    genericExamples = de
      ? `BEISPIELE:\n- Mit Wert: {"value": "Beispielwert", "confidence": 0.9}\n- Ohne Wert: {"value": null, "confidence": 0.8}`
      : `EXAMPLES:\n- With value: {"value": "example value", "confidence": 0.9}\n- Without value: {"value": null, "confidence": 0.8}`;
  }

  const promptSections = [
    headerLine,
    outputFormat,
    genericExamples,
    fewShotSection,
    "",
    fieldLine,
    currentLine,
    "",
    ...(descLine ? [descLine, ""] : []),
    "",
    rulesTitle,
    ...formattingRules.map(r => `- ${r}`),
    "",
    oldLabel,
    oldText || "(leer)",
    "",
    newLabel,
    newText,
  ].filter(line => line !== "");

  return promptSections.join("\n");
}