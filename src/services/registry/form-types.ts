import { z } from "zod";

/** -------- transcription -------- */
export type TranscribeResponse = {
  transcript: string;
  language?: string;
  durationInSeconds?: number;
};

export type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

/** -------- template filling -------- */
export type FieldType = "text" | "textarea" | "date" | "number" | "enum";

export type FormTemplateField = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];   // for enum
  pattern?: string;     // optional regex for text fields
  description?: string;
};

export type CurrentFieldValue = {
  value: string | number | null;
  source?: "user" | "ai";
  locked?: boolean;     // if true, never overwrite
};


export type FewShotExample = {
  id: string;
  text: string;
  expected: Record<string, string | number | null>;
};


export type GetFilledTemplateInput = {
  templateId?: string;
  fields: FormTemplateField[];
  transcript: string;
  currentValues?: Record<string, CurrentFieldValue>;
  locale?: string;
  timezone?: string;
  fewShots?: FewShotExample[];
  options?: {
    mode?: "incremental" | "fresh";
    fillOnlyEmpty?: boolean;
    preserveUserEdits?: boolean;
    returnEvidence?: boolean;
  };
};

export type FilledField = {
  value: string | number | null;
  confidence?: number;
  changed?: boolean;
  previousValue?: string | number | null;
  source: "ai" | "user";
  evidence?: {
    transcriptSnippet?: string;
    startChar?: number;
    endChar?: number;
  };
};

export type GetFilledTemplateResult = {
  filled: Record<string, FilledField>;
  model: string;
  traceId?: string;
};
