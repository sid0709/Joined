import { isHttpUrl } from "../../lib/httpUrl.js";
import { isFound } from "../../routineKit/html.js";
import { workModeFrom } from "../../routineKit/workMode.js";

export { workModeFrom };

export function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

export function asStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => asText(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/,|·/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function asFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function firstHttpUrl(...values) {
  for (const value of values) {
    if (isHttpUrl(value)) return value.trim();
  }
  return "";
}

export function firstFound(...values) {
  for (const value of values) {
    if (isFound(value)) return value;
  }
  return values.at(-1);
}

export function joinSections(parts) {
  return parts
    .map((part) => asText(part))
    .filter(Boolean)
    .join("\n\n");
}

export function skillNames(skills) {
  if (!Array.isArray(skills)) return [];
  return skills
    .map((item) =>
      typeof item === "string" ? asText(item) : asText(item?.skill || item?.displayName),
    )
    .filter(Boolean);
}

export function socialLinks({ linkedin, x, twitter, facebook, github, other } = {}) {
  const links = {};
  if (isHttpUrl(linkedin)) links.linkedin = linkedin.trim();
  const twitterUrl = firstHttpUrl(x, twitter);
  if (twitterUrl) links.x = twitterUrl;
  if (isHttpUrl(facebook)) links.facebook = facebook.trim();
  if (isHttpUrl(github)) links.github = github.trim();
  for (const [key, value] of Object.entries(other ?? {})) {
    if (isHttpUrl(value) && !links[key]) links[key] = value.trim();
  }
  return links;
}

export function postedAtFrom(value) {
  const text = asText(value);
  if (!text) return "";
  if (
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(text) &&
    !text.includes("T") &&
    !text.endsWith("Z")
  ) {
    return text.replace(" ", "T") + "Z";
  }
  return text;
}
