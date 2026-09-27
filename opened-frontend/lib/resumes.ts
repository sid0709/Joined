import { daysFromToday } from "@/lib/dates";

export type ResumeFileType = "PDF" | "DOCX";
export type ParseStatus = "parsed" | "parsing" | "failed";

export type Resume = {
  id: string;
  label: string;
  fileName: string;
  fileType: ResumeFileType;
  sizeBytes: number;
  updated: Date;
  isDefault: boolean;
  parse: ParseStatus;
  /** Applications that went out with this version. */
  usedIn: number;
  /** 0–100: how well a parser can read it. */
  score: number;
  skills: string[];
  sections: { label: string; value: string }[];
  suggestions: string[];
};

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const RESUME_ACCEPT = ".pdf,.docx";
export const RESUME_LABEL_MAX_LENGTH = 40;
export const STRONG_SCORE = 80;
/** How long the demo parser pretends to work. */
export const PARSE_DELAY_MS = 1800;

export const PARSE_META: Record<
  ParseStatus,
  { label: string; dot: "success" | "warning" | "error" }
> = {
  parsed: { label: "Parsed", dot: "success" },
  parsing: { label: "Parsing…", dot: "warning" },
  failed: { label: "Couldn’t parse", dot: "error" },
};

export const RESUMES: Resume[] = [
  {
    id: "resume-general",
    label: "General",
    fileName: "Jordan-Avery-Resume.pdf",
    fileType: "PDF",
    sizeBytes: 184_320,
    updated: daysFromToday(-8),
    isDefault: true,
    parse: "parsed",
    usedIn: 5,
    score: 92,
    skills: ["Product strategy", "Design systems", "Prototyping", "User research", "Figma"],
    sections: [
      { label: "Experience", value: "3 roles · 8 years" },
      { label: "Education", value: "BFA, Interaction Design" },
      { label: "Contact", value: "Email, phone, portfolio" },
      { label: "Length", value: "1 page" },
    ],
    suggestions: [
      "Add a measurable result to your Harbor role.",
      "Spell out “DS” as “design systems” for keyword search.",
    ],
  },
  {
    id: "resume-design",
    label: "Design-focused",
    fileName: "Jordan-Avery-Portfolio-Resume.pdf",
    fileType: "PDF",
    sizeBytes: 2_516_582,
    updated: daysFromToday(-55),
    isDefault: false,
    parse: "parsed",
    usedIn: 3,
    score: 74,
    skills: ["Visual design", "Brand", "Motion", "Illustration"],
    sections: [
      { label: "Experience", value: "3 roles · 8 years" },
      { label: "Education", value: "BFA, Interaction Design" },
      { label: "Contact", value: "Email, portfolio" },
      { label: "Length", value: "2 pages" },
    ],
    suggestions: [
      "Two-column layouts are harder to parse. Try a single column.",
      "Text inside images can’t be read — add skills as plain text.",
      "Add a phone number so recruiters can reach you quickly.",
    ],
  },
  {
    id: "resume-research",
    label: "Research roles",
    fileName: "Avery-UXR.docx",
    fileType: "DOCX",
    sizeBytes: 96_256,
    updated: daysFromToday(-120),
    isDefault: false,
    parse: "failed",
    usedIn: 0,
    score: 0,
    skills: [],
    sections: [],
    suggestions: ["We couldn’t read this file. Export it again as a PDF and re-upload."],
  },
];

export function newResumeFromFile(file: File): Resume {
  const isDocx = file.name.toLowerCase().endsWith(".docx");
  return {
    id: `resume-${file.name}-${file.lastModified}`,
    label: file.name.replace(/\.[^.]+$/, "").slice(0, RESUME_LABEL_MAX_LENGTH),
    fileName: file.name,
    fileType: isDocx ? "DOCX" : "PDF",
    sizeBytes: file.size,
    updated: new Date(),
    isDefault: false,
    parse: "parsing",
    usedIn: 0,
    score: 0,
    skills: [],
    sections: [],
    suggestions: [],
  };
}

/** What the demo parser "finds" once it finishes. */
export function parsedResume(resume: Resume): Resume {
  return {
    ...resume,
    parse: "parsed",
    score: 81,
    skills: ["Product design", "Prototyping", "Research"],
    sections: [
      { label: "Experience", value: "Detected" },
      { label: "Contact", value: "Email" },
    ],
    suggestions: ["Review the parsed experience before using this version."],
  };
}
