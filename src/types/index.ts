/**
 * A flexible key-value representation of a filled form.
 */
export interface Form {
  [key: string]: any; // Use Zod/validation to enforce strict types elsewhere
}

/**
 * Represents a single form field in a template.
 */
export interface TemplateField {
  type: "text" | "number" | "date" | "boolean"; // extend as needed
  question: string;
  required: boolean;
}

/**
 * Interface for a Template Definition, used to guide the AI in filling forms.
 */
export interface TemplateDefinition {
  id?: string;
  name: string;
  structure: {
    fields: TemplateField[];
  };
}

/**
 * Optional extension that includes AI context or prioritization.
 */
export interface EnhancedTemplateDefinition extends TemplateDefinition {
  context?: string;
  priority?: string;
}
