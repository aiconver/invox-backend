import { ExtractionResult, EnhancedTemplateDefinition } from "../types";

export const validateAndPostProcess = async (
  extracted: Record<string, any>,
  template: EnhancedTemplateDefinition,
  threshold: number
): Promise<ExtractionResult> => {
  const validated: Record<string, any> = {};
  const warnings: string[] = [];
  const missing: string[] = [];
  let confidence = 1.0;

  for (const [key, def] of Object.entries(template.fields)) {
    const val = extracted[key];
    const d = typeof def === "string" ? { type: def } : def;

    if (!val) {
      if (d.required) missing.push(key);
      confidence *= 0.8;
    } else {
      validated[key] = val;
    }
  }

  const completeness = Object.keys(validated).length / Object.keys(template.fields).length;
  confidence = Math.min(confidence, 0.3 + completeness * 0.7);

  return {
    message: `Filled with confidence ${(confidence * 100).toFixed(1)}%`,
    filledTemplate: validated,
    confidence: Math.round(confidence * 100) / 100,
    missingFields: missing,
    warnings,
  };
};
