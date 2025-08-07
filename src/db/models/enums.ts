export enum ProcessingType {
  OneModelAllQuestion = "OneModelAllQuestion",
  MultiModelAllQuestion = "MultiModelAllQuestion",
  OneModelOneQuestion = "OneModelOneQuestion",
  MultiModelOneQuestion = "MultiModelOneQuestion",
  HybridFeedback = "HybridFeedback",
}


export const FormStatusEnums = {
  Submitted: "submitted",
  Approved: "approved",
  Rejected: "rejected",
} as const;
