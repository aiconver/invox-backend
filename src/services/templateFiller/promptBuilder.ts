import { FormTemplateField } from "../registry";

export function buildPrompt({
  field,
  oldText,
  newText,
  templateId,
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
  locale: string;
  timezone: string;
  descLine?: string | null;
  perFieldDemos: string[];
  rules: string[];
  currentValue?: any;
}) {
  return [
    `Template ID: ${templateId ?? "(unspecified)"} | Locale: ${locale} | Timezone: ${timezone}`,
    ``,
    `Field: ${field.label} (id: ${field.id}, type: ${field.type}${field.required ? ", required" : ""})`,
    currentValue
      ? `Current value: ${JSON.stringify(currentValue)}`
      : `Current value: null`,
    ``,
    ...(descLine ? [descLine, ``] : []),
    ...(perFieldDemos.length ? [``, ...perFieldDemos] : []),
    ``,
    `Rules:`,
    ...rules.map(r => `- ${r}`),
    ``,
    `OLD transcript (context only; do not extract from this):`,
    oldText || "(empty)",
    ``,
    `NEW transcript (extract ONLY from this):`,
    newText,
  ].join("\n");
}
