import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** H1 required on every file in docs/legal. */
export const LEGAL_DOC_TITLE = "Draft — not legal advice";

export const LEGAL_DOCUMENTS = [
  "terms",
  "privacy",
  "cookies",
  "premium-terms",
  "scout-contractor",
] as const;

export type LegalDocumentName = (typeof LEGAL_DOCUMENTS)[number];

export type LegalSection = { title: string; body: string };

/**
 * Split a docs/legal markdown file into section cards.
 * Keep this function identical to joined-frontend/lib/legal-docs.ts.
 */
export function parseLegalMarkdown(source: string): LegalSection[] {
  const sections: LegalSection[] = [];
  let sawDraft = false;
  let title = "";
  let lines: string[] = [];

  const flush = () => {
    if (!title) return;
    const body = lines.join(" ").replace(/\s+/g, " ").trim();
    if (!body) throw new Error(`legal section "${title}" is empty`);
    sections.push({ title, body });
    title = "";
    lines = [];
  };

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      if (line.slice(2).trim() !== LEGAL_DOC_TITLE) {
        throw new Error(`legal draft title must be "${LEGAL_DOC_TITLE}"`);
      }
      sawDraft = true;
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      title = line.slice(3).trim();
      if (!title) throw new Error("legal section is missing a title");
      continue;
    }
    if (!line) continue;
    if (title) lines.push(line);
  }
  flush();
  if (!sawDraft) throw new Error(`legal draft is missing "${LEGAL_DOC_TITLE}"`);
  if (sections.length === 0) throw new Error("legal draft has no sections");
  return sections;
}

function legalDir(): string {
  const candidates = [
    join(process.cwd(), "docs", "legal"),
    join(process.cwd(), "..", "docs", "legal"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "README.md"))) return dir;
  }
  throw new Error("docs/legal was not found from the app working directory");
}

export function loadLegalSections(name: LegalDocumentName): LegalSection[] {
  const source = readFileSync(join(legalDir(), `${name}.md`), "utf8");
  return parseLegalMarkdown(source);
}
