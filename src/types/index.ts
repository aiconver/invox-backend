// src/types/index.ts

/**
 * Interface for a User object.
 */
export interface User {
  id: string;
  username: string;
  password?: string; // Password can be optional for fetched users, but required for creation
}

/**
 * Interface for generic Form Data.
 * You should expand this with specific fields relevant to your application's forms.
 */
export interface FormData {
  [key: string]: any; // Allows for flexible form data structure
  // Example:
  // name?: string;
  // age?: number;
  // email?: string;
}

/**
 * Interface for a Template Definition, used to guide the AI in filling forms.
 */
export interface TemplateDefinition {
  templateName: string;
  fields: { [key: string]: string }; // Example: { "patientName": "string", "diagnosis": "string" }
}
