/** Server endpoints — configure in plugins/crawler/.env only. */
/* global chrome */

import { parseDuplicateWindowDays } from "./duplicateWindow.js";

function trimEnv(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function normalizeBaseUrl(raw) {
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/** Joined admin API base, e.g. http://127.0.0.1:8081 locally. Scraped jobs go to its temp_jobs. */
export const API_URL = normalizeBaseUrl(trimEnv(import.meta.env.VITE_API_URL));

/** Where the admin API stages scraped jobs in temp_jobs for AI analysis. */
export const CRAWLER_INGEST_PATH = "/v1/public/crawler/jobs";

/** The admin API's health check: `{ ok: true }` when it and its database are up. */
export const HEALTH_PATH = "/health";

/** Bearer token for CRAWLER_INGEST_PATH; the same value as CRAWLER_INGEST_TOKEN on the admin API. */
export const CRAWLER_INGEST_TOKEN = trimEnv(import.meta.env.VITE_CRAWLER_INGEST_TOKEN);
export const JOB_API_STORAGE_KEY = "jobApiBaseUrl";

export function persistJobApiUrlToStorage() {
  if (!API_URL || typeof chrome === "undefined" || !chrome.storage?.local) return;
  try {
    chrome.storage.local.set({ [JOB_API_STORAGE_KEY]: API_URL });
  } catch (e) {
    console.error("Failed to persist job API base URL from env", e);
  }
}

/** Client-controlled duplicate lookback sent with every scraped job. */
export const DUPLICATE_WINDOW_DAYS = parseDuplicateWindowDays(
  trimEnv(import.meta.env.VITE_DUPLICATE_WINDOW_DAYS),
);

/** Job Search "Job scrape source" filter key (`createdBy` on ingest). */
export const DEFAULT_SCRAPE_SOURCE = "avalon-scrapper";

export const SCRAPE_SOURCE = trimEnv(import.meta.env.VITE_SCRAPE_SOURCE) || DEFAULT_SCRAPE_SOURCE;

/** Spirit / autofill service (content script + Agent tab). */
export const SPIRIT_API_URL = normalizeBaseUrl(trimEnv(import.meta.env.VITE_SPIRIT_API_URL));

export const SPIRIT_API_STORAGE_KEY = "spiritApiBaseUrl";

export function persistSpiritApiUrlToStorage() {
  if (!SPIRIT_API_URL || typeof chrome === "undefined" || !chrome.storage?.local) return;

  try {
    chrome.storage.local.set({ [SPIRIT_API_STORAGE_KEY]: SPIRIT_API_URL });
  } catch (e) {
    console.error("Failed to persist Spirit API base URL from env", e);
  }
}
