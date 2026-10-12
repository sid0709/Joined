const MS = Object.freeze({
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
});

const UNIT_ALIASES = Object.freeze({
  second: "second",
  seconds: "second",
  sec: "second",
  secs: "second",
  minute: "minute",
  minutes: "minute",
  min: "minute",
  mins: "minute",
  hour: "hour",
  hours: "hour",
  hr: "hour",
  hrs: "hour",
  day: "day",
  days: "day",
  week: "week",
  weeks: "week",
  month: "month",
  months: "month",
  year: "year",
  years: "year",
});

const RELATIVE_RE =
  /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)\s+ago/i;
const YESTERDAY_RE = /\byesterday\b/i;
const JUST_NOW_RE = /\bjust now\b/i;
const RELATIVE_MARK_RE = /(?:re)?posted|\bago\b|\byesterday\b|\bjust now\b/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIME_RE = /T\d{2}:\d{2}|\d{2}:\d{2}:\d{2}/;

/** Keep Built In's visible relative stamp, including Reposted / Yesterday. */
export function postedAgoText(value) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || !RELATIVE_MARK_RE.test(text)) return "";
  if (YESTERDAY_RE.test(text) || JUST_NOW_RE.test(text) || RELATIVE_RE.test(text)) return text;
  return "";
}

export function datePostedHasTime(value) {
  return HAS_TIME_RE.test(String(value || "").trim());
}

function parseDatePosted(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (DATE_ONLY_RE.test(text)) {
    const date = new Date(`${text}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Resolve a Built In relative stamp against `now`. Null when the text is not a stamp. */
export function postedAtFromAgo(text, now = new Date()) {
  const stamp = postedAgoText(text);
  if (!stamp) return null;
  const base = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(base.getTime())) return null;
  if (YESTERDAY_RE.test(stamp)) return new Date(base.getTime() - MS.day);
  if (JUST_NOW_RE.test(stamp)) return base;
  const match = stamp.match(RELATIVE_RE);
  if (!match) return null;
  const unit = UNIT_ALIASES[match[2].toLowerCase()];
  const count = Number(match[1]);
  if (!unit || !Number.isFinite(count)) return null;
  return new Date(base.getTime() - count * MS[unit]);
}

function toIso(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

export const POSTED_AT_SOURCE = Object.freeze({
  JSONLD: "jsonld",
  JSONLD_AGO: "jsonld+ago",
  AGO: "ago",
  NONE: "none",
});

const INTRA_DAY_UNITS = Object.freeze(new Set(["second", "minute", "hour"]));

function postedResult(date, source) {
  return { postedAt: toIso(date), postedAtSource: source };
}

function utcDateKey(date) {
  return toIso(date).slice(0, 10);
}

function agoUnit(text) {
  const stamp = postedAgoText(text);
  if (!stamp) return "";
  if (JUST_NOW_RE.test(stamp)) return "second";
  const match = stamp.match(RELATIVE_RE);
  return match ? UNIT_ALIASES[match[2].toLowerCase()] || "" : "";
}

/**
 * Prefer a parseable JSON-LD datePosted over a date inferred from relative
 * text. When datePosted is date-only and an intra-day ago stamp (seconds,
 * minutes, hours, or just now) falls on that same UTC date, use the ago clock
 * and mark postedAtSource jsonld+ago.
 */
export function resolvePostedAt({ datePosted = "", postedAgo = "", now = new Date() } = {}) {
  const fromJsonLd = parseDatePosted(datePosted);
  const fromAgo = postedAtFromAgo(postedAgo, now);
  if (
    fromJsonLd &&
    fromAgo &&
    !datePostedHasTime(datePosted) &&
    INTRA_DAY_UNITS.has(agoUnit(postedAgo)) &&
    utcDateKey(fromAgo) === utcDateKey(fromJsonLd)
  ) {
    return postedResult(fromAgo, POSTED_AT_SOURCE.JSONLD_AGO);
  }
  if (fromJsonLd) return postedResult(fromJsonLd, POSTED_AT_SOURCE.JSONLD);
  if (fromAgo) return postedResult(fromAgo, POSTED_AT_SOURCE.AGO);
  return postedResult(null, POSTED_AT_SOURCE.NONE);
}
