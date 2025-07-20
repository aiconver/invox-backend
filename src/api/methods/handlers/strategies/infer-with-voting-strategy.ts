import { EnhancedTemplateDefinition, ExtractionResult } from "../../types";

function mockAnswerFor(type: string): any {
  switch (type) {
    case "text":
    case "textarea":
      return "Mock voted text";
    case "number":
      return 10;
    case "date":
      return "2023-02-01";
    case "boolean":
      return false;
    case "month":
      return "2023-08";
    case "time":
      return "08:00";
    default:
      return null;
  }
}

export async function inferWithVotingStrategy(
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
    message: "Mock voting inference complete",
    filledTemplate,
    confidence: 0.95,
    missingFields,
    warnings,
  };
}
