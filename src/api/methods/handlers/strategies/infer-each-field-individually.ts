import { EnhancedTemplateDefinition, ExtractionResult } from "../../types";

function mockAnswerFor(type: string): any {
  switch (type) {
    case "text":
    case "textarea":
      return "Mock text";
    case "number":
      return 42;
    case "date":
      return "2023-01-01";
    case "boolean":
      return true;
    case "month":
      return "2023-07";
    case "time":
      return "12:34";
    default:
      return null;
  }
}
export async function inferEachFieldIndividually(
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<ExtractionResult> {
  const filledTemplate: Record<string, any> = {};
  const missingFields: string[] = [];
  const warnings: string[] = [];

  for (const [key, def] of Object.entries(template.fields)) {
    const fieldDef = typeof def === "string" ? { type: def } : def;
    const value = mockAnswerFor(fieldDef.type);
    filledTemplate[key] = value;
  }

  return {
    message: "Mock inference complete",
    filledTemplate,
    confidence: 0.9, // Or average if you compute per-field
    missingFields,
    warnings,
  };
}
