import type { Profile } from "@/lib/profile";

export type ResumeFileType = "PDF" | "DOCX" | "TXT";
export type ParseStatus = "parsed" | "parsing" | "failed";

export type ResumeSection = { label: string; value: string };

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
  /** 0–100: how complete the structured résumé is. */
  score: number;
  skills: string[];
  sections: ResumeSection[];
  suggestions: string[];
  /** Session-only upload. Not persisted — there is no `/v1/me/resumes` API yet. */
  file?: File;
};

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const RESUME_ACCEPT = ".pdf,.docx";
export const RESUME_LABEL_MAX_LENGTH = 40;
export const STRONG_SCORE = 80;
export const READY_SCORE = 40;

export const PROFILE_RESUME_ID = "resume-profile";
export const PROFILE_RESUME_LABEL = "My résumé";
export const PROFILE_RESUME_FILE = "resume.txt";
export const RESUME_EXPORT_TYPE = "text/plain;charset=utf-8";

export const SCORE_CONTACT = 20;
export const SCORE_SUMMARY = 20;
export const SCORE_EXPERIENCE = 25;
export const SCORE_EDUCATION = 15;
export const SCORE_SKILLS = 20;

export const SESSION_FILE_TIP =
  "This file stays in this browser until you leave. Edit the résumé below to save contact, summary, experience, education, and skills to your profile.";

export const PARSE_META: Record<
  ParseStatus,
  { label: string; dot: "success" | "warning" | "error" }
> = {
  parsed: { label: "Ready", dot: "success" },
  parsing: { label: "Reading…", dot: "warning" },
  failed: { label: "Couldn’t parse", dot: "error" },
};

const FILENAME_FILL = /[^a-z0-9]+/g;
const FILENAME_TRIM = /^-|-$/g;

export function isProfileResume(id: string) {
  return id === PROFILE_RESUME_ID;
}

export function hasContact(profile: Profile) {
  return Boolean(profile.name.trim() && (profile.email.trim() || profile.phone.trim()));
}

export function hasSummary(profile: Profile) {
  return Boolean(profile.about.trim() || profile.headline.trim());
}

export function resumeCompleteness(profile: Profile) {
  return (
    (hasContact(profile) ? SCORE_CONTACT : 0) +
    (hasSummary(profile) ? SCORE_SUMMARY : 0) +
    (profile.experience.length > 0 ? SCORE_EXPERIENCE : 0) +
    (profile.education.length > 0 ? SCORE_EDUCATION : 0) +
    (profile.skills.length > 0 ? SCORE_SKILLS : 0)
  );
}

export function isResumeReady(profile: Profile) {
  return resumeCompleteness(profile) >= READY_SCORE;
}

export function resumeSectionSummaries(profile: Profile): ResumeSection[] {
  const experience = profile.experience.length;
  const education = profile.education.length;
  return [
    {
      label: "Contact",
      value: hasContact(profile)
        ? [profile.email, profile.phone]
            .map((part) => part.trim())
            .filter(Boolean)
            .join(" · ") || profile.name.trim()
        : "Add name and email or phone",
    },
    {
      label: "Summary",
      value: hasSummary(profile) ? "Added" : "Add a headline or summary",
    },
    {
      label: "Experience",
      value: experience === 0 ? "Add a role" : experience === 1 ? "1 role" : `${experience} roles`,
    },
    {
      label: "Education",
      value:
        education === 0 ? "Add a school" : education === 1 ? "1 school" : `${education} schools`,
    },
    {
      label: "Skills",
      value:
        profile.skills.length === 0
          ? "Add skills"
          : profile.skills.length === 1
            ? "1 skill"
            : `${profile.skills.length} skills`,
    },
  ];
}

export function resumeSuggestions(profile: Profile): string[] {
  const tips: string[] = [];
  if (!profile.name.trim())
    tips.push("Add your name so recruiters know who this résumé belongs to.");
  if (!profile.email.trim() && !profile.phone.trim()) {
    tips.push("Add an email or phone number so recruiters can reach you.");
  } else if (!profile.phone.trim()) {
    tips.push("Add a phone number so recruiters can reach you quickly.");
  }
  if (!hasSummary(profile)) tips.push("Write a short summary or headline at the top of the page.");
  if (profile.experience.length === 0) {
    tips.push("Add at least one role with a company and dates.");
  } else if (profile.experience.some((item) => !item.summary.trim())) {
    tips.push("Add a measurable result to at least one role.");
  }
  if (profile.education.length === 0) tips.push("Add a school or program.");
  if (profile.skills.length === 0) tips.push("List the skills you want recruiters to search for.");
  return tips;
}

export function countResumeUses(applications: { resume?: string }[], label: string) {
  return applications.filter((item) => item.resume === label).length;
}

export function defaultResume(resumes: Resume[]) {
  return resumes.find((resume) => resume.isDefault) ?? resumes[0];
}

export function readyResumes(resumes: Resume[]) {
  return resumes.filter((resume) => resume.parse === "parsed");
}

export function profileResume(profile: Profile, usedIn = 0): Resume {
  const score = resumeCompleteness(profile);
  return {
    id: PROFILE_RESUME_ID,
    label: PROFILE_RESUME_LABEL,
    fileName: resumeExportFilename(profile),
    fileType: "TXT",
    sizeBytes: new TextEncoder().encode(resumeExportText(profile)).length,
    updated: new Date(),
    isDefault: true,
    parse: "parsed",
    usedIn,
    score,
    skills: profile.skills,
    sections: resumeSectionSummaries(profile),
    suggestions: resumeSuggestions(profile),
  };
}

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
    parse: "parsed",
    usedIn: 0,
    score: 0,
    skills: [],
    sections: [{ label: "File", value: file.name }],
    suggestions: [SESSION_FILE_TIP],
    file,
  };
}

export function resumeExportFilename(profile: Profile) {
  const slug = slugFilename(profile.name.trim());
  return slug ? `${slug}-resume.txt` : PROFILE_RESUME_FILE;
}

export function resumeExport(profile: Profile) {
  return {
    filename: resumeExportFilename(profile),
    text: resumeExportText(profile),
    type: RESUME_EXPORT_TYPE,
  };
}

export function resumeExportText(profile: Profile) {
  const lines: string[] = [];
  const name = profile.name.trim() || PROFILE_RESUME_LABEL;
  lines.push(name);
  if (profile.headline.trim()) lines.push(profile.headline.trim());
  const contact = [profile.email, profile.phone, profile.location]
    .map((part) => part.trim())
    .filter(Boolean);
  if (contact.length > 0) lines.push(contact.join(" · "));
  const links = [profile.links.linkedin, profile.links.github, profile.links.portfolio]
    .map((part) => part.trim())
    .filter(Boolean);
  if (links.length > 0) lines.push(links.join(" · "));

  pushSection(lines, "Summary", profile.about.trim() ? [profile.about.trim()] : []);

  const roles = profile.experience.map((item) => {
    const title = [item.role.trim(), item.company.trim()].filter(Boolean).join(" — ");
    const heading = item.period.trim() ? `${title} (${item.period.trim()})` : title;
    return [heading, item.summary.trim()].filter(Boolean).join("\n");
  });
  pushSection(lines, "Experience", roles);

  const schools = profile.education.map((item) => {
    const detail = [item.degree.trim(), item.field.trim()].filter(Boolean).join(", ");
    const title = [item.school.trim(), detail].filter(Boolean).join(" — ");
    const heading = item.period.trim() ? `${title} (${item.period.trim()})` : title;
    return [heading, item.summary.trim()].filter(Boolean).join("\n");
  });
  pushSection(lines, "Education", schools);

  pushSection(lines, "Skills", profile.skills.length > 0 ? [profile.skills.join(", ")] : []);

  return lines.join("\n").trim() + "\n";
}

function pushSection(lines: string[], title: string, blocks: string[]) {
  if (blocks.length === 0) return;
  lines.push("", title.toUpperCase(), ...blocks);
}

function slugFilename(value: string) {
  return value.toLowerCase().replace(FILENAME_FILL, "-").replace(FILENAME_TRIM, "");
}
