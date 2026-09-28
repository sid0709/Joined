/** What Next passes a page as searchParams. */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** One query value, or "" when missing or repeated. */
export function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}
