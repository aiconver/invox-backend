export interface FieldDefinition {
  type: string;
  required?: boolean;
  description?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    enum?: string[];
  };
}

export interface EnhancedTemplateDefinition {
  templateName: string;
  fields: Record<string, FieldDefinition | string>;
  context?: string;
  priority?: string[];
}

export interface TemplateDefinition {
  templateName: string;
  fields: Record<string, FieldDefinition | string>;
}

export interface ExtractionResult {
  message: string;
  filledTemplate: Record<string, any>;
  confidence: number;
  missingFields: string[];
  warnings: string[];
}
