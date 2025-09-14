import type { CurrentFieldValue, FormTemplateField } from "./form-types";

/** formatting for prompt */
export function formatTemplateForPrompt(fields: FormTemplateField[]): string {
  return fields
    .map((f) => {
      const base = `- id: ${f.id} | label: ${f.label} | type: ${f.type}${f.required ? " (required)" : ""}`;
      if (f.type === "enum" && f.options?.length) {
        return `${base} | options: [${f.options.join(", ")}]`;
      }
      return base;
    })
    .join("\n");
}

export function formatCurrentValuesForPrompt(
  currentValues: Record<string, CurrentFieldValue> | undefined
): string {
  if (!currentValues) return "(none)";
  const lines = Object.entries(currentValues).map(([id, v]) => {
    const val =
      typeof v?.value === "string" || typeof v?.value === "number"
        ? JSON.stringify(v.value)
        : "null";
    return `- ${id}: ${val} (source: ${v.source ?? "ai"}, locked: ${v.locked ? "true" : "false"})`;
  });
  return lines.join("\n");
}

/** evidence offsets */
export function attachOffsetsFromSnippet(
  transcript: string,
  snippet?: string
): { startChar?: number; endChar?: number } {
  if (!snippet) return {};
  const idx = transcript.indexOf(snippet);
  if (idx < 0) return {};
  return { startChar: idx, endChar: idx + snippet.length };
}

/** value helpers */
export function isEmptyValue(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}
