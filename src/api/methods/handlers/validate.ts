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

  const fieldEntries = Array.isArray(template.fields)
    ? template.fields
    : Object.entries(template.fields);

  const fieldKeys = Array.isArray(template.fields)
    ? template.fields.map((field: any) => field.question)
    : Object.keys(template.fields);

  fieldKeys.forEach((fieldName, i) => {
    const def = template.fields[fieldName] ?? {};
    const d = typeof def === "string" ? { type: def } : def;
    const val = extracted[i.toString()];

    if (!val) {
      if (d.required) missing.push(fieldName);
      confidence *= 0.8;
    } else {
      validated[fieldName] = val;
    }
  });

  const completeness = Object.keys(validated).length / fieldKeys.length;
  confidence = Math.min(confidence, 0.3 + completeness * 0.7);

  console.log(JSON.stringify({
    message: `Filled with confidence ${(confidence * 100).toFixed(1)}%`,
    filledTemplate: validated,
    confidence: Math.round(confidence * 100) / 100,
    missingFields: missing,
    warnings,
  }, null, 2));

  return {
    message: `Filled with confidence ${(confidence * 100).toFixed(1)}%`,
    filledTemplate: validated,
    confidence: Math.round(confidence * 100) / 100,
    missingFields: missing,
    warnings,
  };
};
