// Public, provider-agnostic types for your standalone module

export type FieldType =
  | "string"
  | "number"
  | "integer"
  | "date"
  | "datetime"
  | "boolean"
  | "enum"
  | "email"
  | "phone"
  | "currency"
  | "array"
  | "object";

export type FieldConstraint = {
  required?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: string[];
  format?: "iban" | "vat" | "zipcode" | "country" | "url";
  confidenceThreshold?: number;
  parseLocale?: string;
};

export type Field = {
  id: string;
  label?: string;
  type: FieldType;
  description?: string;
  constraints?: FieldConstraint;
  properties?: Record<string, Field>;
  items?: Field;
  priority?: "high" | "medium" | "low";
};

export type Schema = {
  version: string;
  title?: string;
  fields: Field[];
};

export type KnowledgeItem =
  | { kind: "text"; title?: string; content: string }
  | { kind: "glossary"; terms: Array<{ term: string; definition: string }> }
  | { kind: "rules"; rules: string[] }
  | { kind: "faq"; pairs: Array<{ q: string; a: string }> };

export type DomainKnowledge = {
  context?: string;
  items?: KnowledgeItem[];
};

export type FewShotExample = {
  transcript: string;
  answers: Record<string, unknown>;
  notes?: string;
};

export enum ProcessingType {
  OneModelAllQuestion = "OneModelAllQuestion",
  OneModelOneQuestion = "OneModelOneQuestion",
  MultiModelAllQuestion = "MultiModelAllQuestion",
  MultiModelOneQuestion = "MultiModelOneQuestion",
  HybridFeedback = "HybridFeedback",
}

export type ExtractionInput = {
  transcript: string | { text: string; locale?: string; sourceId?: string };
  structure: Schema;
  knowledge?: DomainKnowledge;
  examples?: FewShotExample[];
  processingType?: ProcessingType;
};

export type Evidence = { quote: string; start: number; end: number } | null;

export type FieldStatus = "extracted" | "absent" | "conflict";

export type FieldResult = {
  value?: unknown;
  confidence: number; // 0..1
  status: FieldStatus;
  annotation?: string | null;
  actionMessage?: string | null;
  reason?:
    | "info_not_found"
    | "contradictory_evidence"
    | "format_mismatch"
    | "low_confidence"
    | "not_applicable"
    | null;
  evidence: Evidence;
  provenance?: { model?: string; provider?: string; stage?: string };
  warnings?: string[];
};

export type ExtractionResult = {
  transcript: string;
  processingType: ProcessingType;
  responseTimeMs: number;
  timings?: { [phase: string]: number };
  completeness?: number; // % required fields extracted
  attemptsUsed?: number;
  issues?: string[];
  filled: Record<string, FieldResult>;
};
