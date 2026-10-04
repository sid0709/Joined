export const SUBMIT_TARGET_KEYWORDS = [
  "submit",
  "send application",
  "send proposal",
  "apply",
  "apply now",
  "apply today",
  "register",
  "sign up",
  "sign me up",
  "get started",
  "join now",
  "next",
  "continue",
  "bid",
  "place bid",
  "send bid",
  "confirm",
];

export const SUBMIT_CONFIRMATION_KEYWORDS = [
  "applied.",
  "application submitted",
  "submitted your application",
  "thanks for applying",
  "thank you for applying",
  "thanks so much for applying",
  "already applied",
  "you applied",
  "application received",
  "application has been received",
  "we have received your application",
  "thank you for your application",
  "we received your application",
  "we have received your proposal",
  "thank you for your proposal",
  "thanks for your proposal",
  "we received your proposal",
  "proposal sent",
  "proposal submitted",
  "bid submitted",
  "bid placed",
  "you have applied",
  "you have already applied",
];

export function collectTextCandidates(element) {
  if (!element) return [];
  const candidates = [
    element.innerText,
    element.value,
    element.textContent,
    element.getAttribute?.("aria-label"),
    element.getAttribute?.("title"),
    element.getAttribute?.("data-testid"),
    element.getAttribute?.("name"),
    element.getAttribute?.("id"),
  ];

  return candidates.map((text) => (typeof text === "string" ? text.trim() : "")).filter(Boolean);
}

export function matchesSubmitKeyword(element, keywords = SUBMIT_TARGET_KEYWORDS) {
  const keywordPool =
    Array.isArray(keywords) && keywords.length ? keywords : SUBMIT_TARGET_KEYWORDS;
  const candidates = collectTextCandidates(element);
  if (!candidates.length) return false;
  const lowered = candidates.map((text) => text.toLowerCase());
  return lowered.some((text) => keywordPool.some((word) => text.includes(word)));
}

export function containsConfirmationKeyword(text, keywords = SUBMIT_CONFIRMATION_KEYWORDS) {
  if (!text || typeof text !== "string") return null;
  const keywordPool =
    Array.isArray(keywords) && keywords.length ? keywords : SUBMIT_CONFIRMATION_KEYWORDS;
  const lowered = text.toLowerCase();
  return keywordPool.find((keyword) => lowered.includes(keyword));
}
