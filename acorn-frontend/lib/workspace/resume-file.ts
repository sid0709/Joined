import type { ApplicantProfile, CareerEntry } from "./profile";

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain";
export const MIN_RESUME_TEXT = 40;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/;
const LINKEDIN = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s)]+/i;
const GITHUB = /https?:\/\/(?:www\.)?github\.com\/[^\s)]+/i;
const PORTFOLIO = /https?:\/\/[^\s)]+/i;
const DATE_RANGE =
  /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2})\s*(?:-|–|—|to)\s*(present|current|now|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2}))/i;

const SECTION =
  /^(experience|work experience|employment|education|skills|summary|objective|projects|contact)\b/i;
const SCHOOL = /\b(university|college|school|institute|academy)\b/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Reads a text résumé, or the visible strings inside a PDF. */
export async function readResumeFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdfText(new Uint8Array(await file.arrayBuffer()));
  }
  return file.text();
}

export function profileFromResumeText(text: string, current: ApplicantProfile): ApplicantProfile {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const email = text.match(EMAIL)?.[0] ?? current.email;
  const phone = text.match(PHONE)?.[0] ?? current.phone;
  const linkedin = text.match(LINKEDIN)?.[0] ?? current.linkedin;
  const github = text.match(GITHUB)?.[0] ?? current.github;
  const portfolio =
    text.match(PORTFOLIO)?.[0] && !text.match(LINKEDIN) && !text.match(GITHUB)
      ? text.match(PORTFOLIO)?.[0]
      : urlsExcept(text, linkedin, github) || current.portfolio;
  const name = lines.find(looksLikeName);
  // "Jordan Avery Lee": first, middle, last. Two words have no middle name.
  const [firstName, ...rest] = (name ?? current.fullName).split(/\s+/);
  const lastName = rest.length > 1 ? rest.slice(1).join(" ") : rest.join(" ");
  const middleName = rest.length > 1 ? rest[0] : "";
  const timeline = timelineFromLines(lines);
  return {
    ...current,
    fullName: name ?? current.fullName,
    firstName: firstName || current.firstName,
    middleName: name ? middleName : current.middleName,
    lastName: lastName || current.lastName,
    email,
    phone,
    linkedin,
    github,
    portfolio: portfolio ?? current.portfolio,
    timeline: timeline.length > 0 ? timeline : current.timeline,
  };
}

function urlsExcept(text: string, linkedin: string, github: string) {
  const found = text.match(new RegExp(PORTFOLIO, "gi")) ?? [];
  return found.find((url) => url !== linkedin && url !== github);
}

function looksLikeName(line: string) {
  if (line.length > 40 || SECTION.test(line) || EMAIL.test(line) || /\d/.test(line)) return false;
  const words = line.split(/\s+/);
  return words.length >= 2 && words.length <= 4 && words.every((word) => /^[A-Z]/.test(word));
}

function timelineFromLines(lines: string[]): CareerEntry[] {
  let section: CareerEntry["kind"] = "role";
  const entries: CareerEntry[] = [];
  lines.forEach((line, index) => {
    if (/^education\b/i.test(line)) {
      section = "education";
      return;
    }
    if (/^(experience|work experience|employment)\b/i.test(line)) {
      section = "role";
      return;
    }
    const dated = parseDates(line);
    if (!dated) return;
    const previous = lines[index - 1] ?? "";
    const before = lines[index - 2] ?? "";
    const inline = line
      .split(DATE_RANGE)[0]
      ?.replace(/[|•–—-]+$/g, "")
      .trim();
    const title = inline || previous;
    const org = inline ? previous : before;
    if (!title || SECTION.test(title)) return;
    const kind =
      section === "education" || SCHOOL.test(org) || SCHOOL.test(title) ? "education" : "role";
    entries.push({
      id: `resume-${entries.length}-${title.slice(0, 12)}`,
      kind,
      title: kind === "education" && SCHOOL.test(title) ? org || title : title,
      org: kind === "education" && SCHOOL.test(title) ? title : org,
      summary: "",
      ...dated,
    });
  });
  return entries.slice(0, 8);
}

function parseDates(line: string) {
  const match = line.match(DATE_RANGE);
  if (!match) return null;
  const current = /present|current|now/i.test(match[3] ?? "");
  return {
    startMonth: monthOf(match[1] ?? ""),
    startYear: match[2] ?? "",
    endMonth: current ? "" : monthOf(match[3] ?? ""),
    endYear: current ? "" : (match[4] ?? ""),
    current,
  };
}

function monthOf(token: string) {
  const index = MONTHS.findIndex((month) => token.toLowerCase().includes(month));
  return index >= 0 ? String(index + 1) : "1";
}

function unescapePdf(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function extractPdfText(bytes: Uint8Array) {
  const raw = new TextDecoder("latin1").decode(bytes);
  const pieces: string[] = [];
  for (const match of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    pieces.push(unescapePdf(match[1] ?? ""));
  }
  for (const match of raw.matchAll(/\[([\s\S]{0,800}?)\]\s*TJ/g)) {
    for (const inner of (match[1] ?? "").matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
      pieces.push(unescapePdf(inner[1] ?? ""));
    }
  }
  return pieces.join("\n");
}
