import { FormTemplateField } from "../registry";

function isDE(lang?: string) {
  return (lang ?? "en").toLowerCase().startsWith("de");
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
  perFieldDemos,
  rules,
  currentValue,
}: {
  field: FormTemplateField;
  oldText: string;
  newText: string;
  templateId?: string;
  lang: string;  // "en" | "de"
  locale: string;
  timezone: string;
  descLine?: string | null;
  perFieldDemos: string[];
  rules: string[];
  currentValue?: any;
}) {
  const de = isDE(lang);

  const headerLine = de
    ? `Vorlagen-ID: ${templateId ?? "(nicht angegeben)"} | Gebietsschema: ${locale} | Zeitzone: ${timezone}`
    : `Template ID: ${templateId ?? "(unspecified)"} | Locale: ${locale} | Timezone: ${timezone}`;

  const fieldLine = de
    ? `Feld: ${field.label} (id: ${field.id}, type: ${field.type}${field.required ? ", erforderlich" : ""})`
    : `Field: ${field.label} (id: ${field.id}, type: ${field.type}${field.required ? ", required" : ""})`;

  const currentLine = de
    ? `Aktueller Wert: ${currentValue !== undefined ? JSON.stringify(currentValue) : "null"}`
    : `Current value: ${currentValue !== undefined ? JSON.stringify(currentValue) : "null"}`;

  const rulesTitle = de ? "Regeln:" : "Rules:";

  const oldLabel = de
    ? "ALTES Transkript (nur Kontext; NICHT daraus extrahieren):"
    : "OLD transcript (context only; do not extract from this):";

  const newLabel = de
    ? "NEUES Transkript (AUSSCHLIESSLICH hieraus extrahieren):"
    : "NEW transcript (extract ONLY from this):";

  // Optional language nudge (helps the model stay in the right language in any free text)
  const languageHint = de
    ? "Antworten in DEUTSCH. Freitext nur wenn erforderlich."
    : "Answer in ENGLISH. Only include free text when required.";

  return [
    headerLine,
    languageHint,
    "",
    fieldLine,
    currentLine,
    "",
    ...(descLine ? [descLine, ""] : []),
    ...(perFieldDemos.length ? ["", ...perFieldDemos] : []),
    "",
    rulesTitle,
    ...rules.map(r => `- ${r}`),
    "",
    oldLabel,
    oldText || "(leer)",
    "",
    newLabel,
    newText,
  ].join("\n");
}
