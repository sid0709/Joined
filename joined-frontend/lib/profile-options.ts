import type { Option } from "@/lib/profile";

export const MONTH_OPTIONS: Option[] = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Date(2000, index, 1).toLocaleString("en-US", { month: "short" }),
}));

/** Years a role or school can start or end. */
export const MIN_YEAR = 1940;
export const MAX_YEAR = 2100;
