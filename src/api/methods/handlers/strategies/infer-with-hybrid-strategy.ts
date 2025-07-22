import { EnhancedTemplateDefinition, ExtractionResult } from "../../types";

function mockAnswerFor(type: string): any {
  switch (type) {
    case "text":
    case "textarea":
      return "Mock hybrid response";
    case "number":
      return 88;
    case "date":
      return "2023-04-01";
    case "boolean":
      return false;
    case "month":
      return "2023-10";
    case "time":
      return "06:45";
    default:
      return null;
  }
}

export async function inferWithHybridStrategy(
  transcript: string,
  template: EnhancedTemplateDefinition
): Promise<ExtractionResult> {
  const filledTemplate: Record<string, any> = {};
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // for (const [key, def] of Object.entries(template.fields)) {
  //   const fieldDef = typeof def === "string" ? { type: def } : def;
  //   const value = mockAnswerFor(fieldDef.type);
  //   filledTemplate[key] = value;
  // }

  return {
    message: "Mock hybrid inference complete",
    filledTemplate,
    confidence: 0.93,
    missingFields,
    warnings,
  };
}
