export const SUBMISSION_FILTERS = [
  { value: "", label: "All" },
  { value: "needs_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
] as const;
