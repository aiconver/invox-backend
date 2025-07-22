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

  const structure = template.structure ?? {};
  const fieldKeys = Object.keys(structure);

  fieldKeys.forEach((fieldName) => {
    const def = structure[fieldName] ?? {};
    const val = extracted[fieldName];

    console.log(`Validating field: ${fieldName} With value: ${val}`);

    if (val === null || val === undefined || val === "") {
      if (def.required) missing.push(fieldName);
      confidence *= 0.8;
    } else {
      validated[fieldName] = val;
    }
  });

  console.log(`Validated fields: ${JSON.stringify(validated)}`);

  const completeness = Object.keys(validated).length / fieldKeys.length;
  confidence = Math.min(confidence, 0.3 + completeness * 0.7);

  const result: ExtractionResult = {
    message: `Filled with confidence ${(confidence * 100).toFixed(1)}%`,
    filledTemplate: validated,
    confidence: Math.round(confidence * 100) / 100,
    missingFields: missing,
    warnings,
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
};
