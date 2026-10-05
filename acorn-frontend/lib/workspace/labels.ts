import { MAIL_LABELS, MAIL_LABEL_ORDER, type MailLabel, type MailMessage } from "./mail";

/**
 * Gmail labels Acorn applies to application mail. You either map each Acorn category to a
 * label you already have, or let Acorn create a set under one parent label. Nothing reaches
 * Gmail yet — acorn-backend has no mail access — so labels are applied in this workspace.
 */

export type LabelMode = "existing" | "create";

/** Each Acorn category → the Gmail label it gets, or null to leave that mail alone. */
export type LabelMap = Record<MailLabel, string | null>;

export type Labeling = {
  mode: LabelMode;
  map: LabelMap;
  appliedAt: string;
};

export const LABEL_NAME_MAX = 40;
export const DEFAULT_PARENT_LABEL = "Acorn";
export const NO_LABEL = "";

/** Stand-in for the labels in your Gmail until Acorn can read them. */
export const SAMPLE_GMAIL_LABELS = [
  "Job search",
  "Recruiters",
  "Interviews",
  "Offers",
  "Rejections",
  "Receipts",
  "Follow up",
  "Personal",
];

/** Words that suggest one of your labels fits a category, strongest first. */
const HINTS: Record<MailLabel, string[]> = {
  interview: ["interview", "recruit", "call"],
  "next-step": ["follow", "next", "action", "todo"],
  offer: ["offer"],
  received: ["receipt", "received", "confirm", "applied"],
  closed: ["reject", "closed", "declin"],
};

/** Your label that best fits each category, or null when none does. */
export function suggestMap(labels: string[]): LabelMap {
  const used = new Set<string>();
  const map = {} as LabelMap;
  MAIL_LABEL_ORDER.forEach((category) => {
    const free = labels.filter((label) => !used.has(label));
    const fit = HINTS[category]
      .map((hint) => free.find((label) => label.toLowerCase().includes(hint)))
      .find(Boolean);
    if (fit) used.add(fit);
    map[category] = fit ?? null;
  });
  return map;
}

/** Labels Acorn would create: "Acorn/Interview", "Acorn/Next step", … */
export function createdMap(parent: string): LabelMap {
  const root = parent.trim() || DEFAULT_PARENT_LABEL;
  const map = {} as LabelMap;
  MAIL_LABEL_ORDER.forEach((category) => {
    map[category] = `${root}/${MAIL_LABELS[category].label}`;
  });
  return map;
}

/** The Gmail label a message carries once labeling has run. */
export function gmailLabelOf(message: MailMessage, labeling: Labeling | null) {
  return labeling ? labeling.map[message.label] : null;
}

/** How many messages each chosen label would get. */
export function labelCounts(mail: MailMessage[], map: LabelMap) {
  const counts = new Map<string, number>();
  mail.forEach((message) => {
    const label = map[message.label];
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

export function isLabeling(value: unknown): value is Labeling {
  return Boolean(
    value && typeof value === "object" && "map" in value && "mode" in value && "appliedAt" in value,
  );
}
