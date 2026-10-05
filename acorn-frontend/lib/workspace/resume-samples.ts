import type { LibraryResume, ResumeDraft } from "./model";

/** Shown in History until you generate a draft of your own. */
export const SAMPLE_HISTORY: ResumeDraft[] = [
  {
    id: "sample-northwind",
    role: "Senior Software Engineer",
    company: "Northwind",
    summary: "A draft aimed at Northwind's senior engineer posting, using the career timeline.",
    focus: ["Hiring tools", "Application flow", "Resume attachment"],
    createdAt: "2026-09-28T15:00:00.000Z",
  },
  {
    id: "sample-lumen",
    role: "Software Engineer",
    company: "Lumen",
    summary: "A draft aimed at Lumen, emphasizing search, profiles, and mail.",
    focus: ["Search", "Profiles", "Mail"],
    createdAt: "2026-09-12T15:00:00.000Z",
  },
  {
    id: "sample-harbor",
    role: "Software Engineer",
    company: "Harbor Health",
    summary: "A draft aimed at Harbor Health's scheduling team.",
    focus: ["Scheduling", "Internal tools"],
    createdAt: "2026-08-30T15:00:00.000Z",
  },
];

/** Shown in the Library until you upload a file of your own. */
export const SAMPLE_LIBRARY: LibraryResume[] = [
  {
    id: "sample-upload-main",
    name: "Jordan-Lee-resume.pdf",
    detail: "Uploaded on Profile",
    addedAt: "2026-09-02T15:00:00.000Z",
    size: 184_320,
    isDefault: true,
  },
  {
    id: "sample-upload-platform",
    name: "Jordan-Lee-platform-engineering.pdf",
    detail: "Uploaded to the library",
    addedAt: "2026-08-21T15:00:00.000Z",
    size: 201_728,
  },
  {
    id: "sample-upload-manager",
    name: "Jordan-Lee-engineering-manager.txt",
    detail: "Uploaded to the library",
    addedAt: "2026-07-30T15:00:00.000Z",
    size: 9_216,
  },
];
